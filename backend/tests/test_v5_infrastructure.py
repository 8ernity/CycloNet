"""Integration gates require real PostgreSQL and Redis (see compose.test.yml)."""
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch
import pytest
from alembic import command
from alembic.config import Config
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core import shared_state, process_lock
from app.core.database import Base

@pytest.fixture
def infrastructure(monkeypatch):
    url = os.getenv('TEST_POSTGRES_URL')
    redis_url = os.getenv('TEST_REDIS_URL')
    if not url or not redis_url:
        pytest.skip('Real PostgreSQL and Redis endpoints are required')
    url = url.replace('postgresql://', 'postgresql+psycopg2://', 1)
    import redis
    admin = create_engine(url)
    schema = 'verify_' + uuid.uuid4().hex
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA {schema}'))
    db_url = url + f'?options=-csearch_path%3D{schema}'
    monkeypatch.setenv('DATABASE_URL', db_url)
    engine = create_engine(db_url)
    factory = sessionmaker(engine)
    monkeypatch.setattr(shared_state, 'SessionLocal', factory)
    client = redis.from_url(redis_url, decode_responses=True)
    key = 'cyclonet:test:' + uuid.uuid4().hex
    monkeypatch.setattr(process_lock, '_redis_client', client)
    monkeypatch.setattr(process_lock, 'LOCK_KEY', key)
    monkeypatch.setattr(process_lock, 'ENVIRONMENT', 'production')
    monkeypatch.setattr(process_lock, '_is_leader', False)
    config = Config(str(Path(__file__).resolve().parents[1]/'alembic.ini'))
    config.set_main_option('script_location', str(Path(__file__).resolve().parents[1]/'alembic'))
    yield config, engine, client, key
    process_lock.release_worker_leader_lock()
    client.delete(key, key+':generation')
    engine.dispose()
    with admin.begin() as connection:
        connection.execute(text(f'DROP SCHEMA {schema} CASCADE'))
    admin.dispose()

def test_clean_migration_matches_models(infrastructure):
    config, engine, _, _ = infrastructure
    command.upgrade(config, 'head')
    with engine.connect() as connection:
        assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []

def test_existing_history_survives_upgrade_and_rollback(infrastructure):
    config, engine, _, _ = infrastructure
    command.upgrade(config, '7ebcad6e592b')
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO cyclone_archive(id,name) VALUES ('preserved','Historical record')"))
    command.upgrade(config, 'head')
    command.downgrade(config, '7ebcad6e592b')
    command.upgrade(config, 'head')
    with engine.connect() as connection:
        assert connection.execute(text("SELECT name FROM cyclone_archive WHERE id='preserved'")).scalar() == 'Historical record'

def test_redis_acquisition_atomic_under_contention(infrastructure):
    config, engine, client, key = infrastructure
    command.upgrade(config, 'head')
    def acquire(i):
        return client.eval(process_lock.ACQUIRE_LOCK_LUA, 2, key, key+':generation', f'worker-{i}', 60, 0)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(acquire, range(16)))
    assert sum(x > 0 for x in results) == 1

def test_stale_leader_and_wrong_owner_cannot_commit(infrastructure):
    config, engine, client, key = infrastructure
    command.upgrade(config, 'head')
    assert process_lock.acquire_worker_leader_lock()
    first = process_lock.get_leader_generation()
    old_token = process_lock.WORKER_TOKEN
    shared_state.commit_systems([{'id':'first'}], first, old_token, process_lock.update_worker_heartbeat)
    client.delete(key)  # lost/crashed leader; no graceful release
    with patch.object(process_lock, 'WORKER_TOKEN', 'new-worker'):
        assert process_lock.acquire_worker_leader_lock()
        second = process_lock.get_leader_generation()
        assert second > first
        shared_state.commit_systems([{'id':'new'}], second, 'new-worker', process_lock.update_worker_heartbeat)
        with pytest.raises(shared_state.StaleLeaderError):
            shared_state.commit_systems([{'id':'obsolete'}], first, old_token, lambda: True)
        with pytest.raises(shared_state.StaleLeaderError):
            shared_state.commit_systems([], second, old_token, lambda: True)
        client.delete(key)  # expired lease cannot write even with current DB generation
        with pytest.raises(shared_state.StaleLeaderError):
            shared_state.commit_systems([], second, 'new-worker', process_lock.update_worker_heartbeat)
    with engine.connect() as connection:
        assert 'new' in connection.execute(text('SELECT systems_json FROM active_cyclone_state')).scalar()

def test_redis_counter_loss_keeps_monotonic_generation(infrastructure):
    config, _, client, key = infrastructure
    command.upgrade(config, 'head')
    assert process_lock.acquire_worker_leader_lock()
    previous = process_lock.get_leader_generation()
    client.delete(key, key+':generation')
    assert process_lock.acquire_worker_leader_lock()
    assert process_lock.get_leader_generation() > previous

def test_redis_disconnection_prevents_commit(infrastructure):
    config, _, client, key = infrastructure
    command.upgrade(config, 'head')
    assert process_lock.acquire_worker_leader_lock()
    with patch.object(client, 'eval', side_effect=ConnectionError('offline')):
        with pytest.raises(shared_state.StaleLeaderError):
            shared_state.commit_systems([], process_lock.get_leader_generation(), process_lock.WORKER_TOKEN,
                                        process_lock.update_worker_heartbeat)
