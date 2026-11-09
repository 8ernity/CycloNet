import asyncio
import runpy
from unittest.mock import patch

import pytest
from fastapi import Response
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy import text
from app import main
from app.core import auth, database


def test_invalid_auth_aborts_startup_before_workers():
    async def start():
        with patch.object(auth, 'validate_production_auth', side_effect=RuntimeError('Invalid auth')), \
             patch.object(database, 'validate_schema'), \
             patch.object(main, 'acquire_worker_leader_lock', side_effect=AssertionError('Workers started')):
            with pytest.raises(RuntimeError, match='Invalid auth'):
                async with main.lifespan(main.app):
                    pass
    asyncio.run(start())


@pytest.mark.parametrize('environment', [None, '', 'development', 'prod', 'production '])
def test_render_cannot_silently_use_sqlite(monkeypatch, environment):
    monkeypatch.setenv('RENDER', 'true')
    if environment is None:
        monkeypatch.delenv('ENVIRONMENT', raising=False)
    else:
        monkeypatch.setenv('ENVIRONMENT', environment)
    monkeypatch.setenv('DATABASE_URL', 'sqlite:///:memory:')
    with pytest.raises(RuntimeError):
        runpy.run_path('app/core/database.py')


def test_schema_validation_is_read_only_even_in_development(monkeypatch):
    monkeypatch.setenv('ENVIRONMENT', 'development')
    monkeypatch.setattr(database, 'engine', create_engine('sqlite:///:memory:'))
    with patch('alembic.command.upgrade') as upgrade:
        with pytest.raises(RuntimeError, match='migration'):
            database.validate_schema()
        upgrade.assert_not_called()


@pytest.mark.parametrize('jwks', ['http://clerk.example/keys', 'https://user:pass@clerk.example/keys', 'https://'])
def test_production_rejects_malformed_jwks(monkeypatch, jwks):
    monkeypatch.setenv('ENVIRONMENT', 'production')
    monkeypatch.setattr(auth, 'CLERK_ISSUER', 'https://clerk.example')
    monkeypatch.setattr(auth, 'CLERK_PEM_PUBLIC_KEY', '')
    monkeypatch.setattr(auth, 'CLERK_JWKS_URL', jwks)
    monkeypatch.setattr(auth, 'CLERK_AUTHORIZED_PARTIES', {'https://frontend.example'})
    with pytest.raises(RuntimeError):
        auth.validate_production_auth()


def test_legacy_health_cannot_bypass_readiness(monkeypatch):
    monkeypatch.setattr(main, 'health_ready', lambda response: {'status': 'unready'})
    assert main.health(Response())['status'] == 'unready'


def test_api_responses_are_not_shared_cacheable():
    response = TestClient(main.app).get('/api/history/classifications')
    assert response.status_code == 401
    assert 'no-store' in response.headers.get('cache-control', '')
    assert response.headers.get('x-request-id')


def test_revision_marker_alone_cannot_certify_missing_domain_tables(monkeypatch):
    broken=create_engine('sqlite:///:memory:')
    with broken.begin() as conn:
        conn.execute(text('CREATE TABLE alembic_version(version_num VARCHAR(32))'))
        conn.execute(text("INSERT INTO alembic_version VALUES ('20261108_archive_date')"))
    monkeypatch.setattr(database,'engine',broken)
    with pytest.raises(RuntimeError,match='schema'):
        database.validate_schema()
