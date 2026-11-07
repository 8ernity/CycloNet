"""Portable behavioral regressions also executed against audit baseline e097c977.

Only imports available at baseline are used, so failures exercise behavior rather
than missing newly introduced modules. Earlier P0/feed tests cover FIX-001..006.
"""
import time
from unittest.mock import patch
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from fastapi import Response


def test_fix007_unimplemented_satellite_capability_is_explicitly_disabled():
    from app.services.gee_service import SatelliteFloodDetectionService
    service = SatelliteFloodDetectionService()
    service.is_live_gee = True  # Authentication alone is not a processing pipeline.
    result = service.get_satellite_observed_flood(15, 85)
    assert result['features'] == []
    assert result.get('capability_status') == 'DISABLED'
    assert 'no sentinel-1 sar pass detected' not in result['reason'].lower()


def test_fix008_worker_without_lease_cannot_write_authoritative_state(monkeypatch):
    from app.core import process_lock
    from app.services.live_ingestion import LiveIngestionService
    service = LiveIngestionService()
    service._sync_generation = 0
    monkeypatch.setenv('ENVIRONMENT', 'production')
    with patch.object(process_lock, 'update_worker_heartbeat', return_value=False):
        with pytest.raises(RuntimeError):
            service.live_systems = [dict(id='unauthorized-worker-update')]


def test_fix009_production_initialization_does_not_create_unversioned_tables(monkeypatch):
    from app.core import database
    monkeypatch.setenv('ENVIRONMENT', 'production')
    with patch.object(database.Base.metadata, 'create_all') as create:
        database.init_db()
    create.assert_not_called()


@pytest.mark.parametrize('issuer,party', [
    ('https://other.example', 'https://cyclonet.example'),
    ('https://expected.example', 'https://untrusted.example')])
def test_fix010_correctly_signed_token_from_other_clerk_app_is_rejected(monkeypatch, issuer, party):
    from app.core import auth
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = key.public_key().public_bytes(serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    for name, value in dict(ENVIRONMENT='production', CLERK_ISSUER='https://expected.example',
        CLERK_PEM_PUBLIC_KEY=public, CLERK_AUTHORIZED_PARTIES={'https://cyclonet.example'},
        CLERK_AUDIENCE='').items():
        monkeypatch.setattr(auth, name, value, raising=False)
    token = jwt.encode(dict(sub='unrelated-user', exp=int(time.time()) + 60,
        iss=issuer, azp=party), key, algorithm='RS256')
    assert auth.decode_token_payload(token) is None


def test_fix011_production_without_redis_is_unready_even_if_flag_is_false(monkeypatch):
    from app.main import health_ready
    monkeypatch.setenv('ENVIRONMENT', 'production')
    monkeypatch.setenv('REDIS_FAIL_CLOSED', 'false')
    monkeypatch.delenv('REDIS_URL', raising=False)
    response = Response()
    result = health_ready(response)
    assert response.status_code == 503
    assert result['status'] == 'unready'
