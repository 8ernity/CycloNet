"""Source-audit regressions exercised through public API contracts."""
from unittest.mock import PropertyMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api import websocket
from app.services.live_ingestion import LiveIngestionService


def test_active_api_preserves_observation_and_track_provenance():
    system = dict(id='LIVE-IMD-2026-01', name='Source storm', basin='Bay of Bengal',
                  lat=15, lon=85, category='Unclassified', intensity_knots=None,
                  is_live_telemetry=True, is_measured_observation=True,
                  source_type='AGENCY', origin_type='OBSERVED_FEED',
                  track_forecast=[dict(lat=15, lon=85, time_offset_hours=0,
                      category='Unclassified', intensity_knots=None,
                      method='OFFICIAL_OBSERVATION', source='IMD',
                      issue_time_utc='2026-11-07T00:00:00Z')])
    with patch.object(LiveIngestionService, 'live_systems', new_callable=PropertyMock, return_value=[system]):
        response = TestClient(app).get('/api/active-systems')
    assert response.status_code == 200
    actual = response.json()[0]
    assert actual.get('is_live_telemetry') is True
    assert actual.get('is_measured_observation') is True
    assert actual.get('source_type') == 'AGENCY'
    assert actual['track_forecast'][0].get('source') == 'IMD'
    assert actual['track_forecast'][0].get('issue_time_utc') == '2026-11-07T00:00:00Z'


def test_websocket_uses_configured_cors_origin(monkeypatch):
    monkeypatch.delenv('ALLOWED_ORIGINS', raising=False)
    monkeypatch.setenv('CORS_ORIGINS', 'https://cyclonet-frontend-staging.onrender.com')
    monkeypatch.setenv('ENVIRONMENT', 'production')
    with TestClient(app).websocket_connect('/ws/cyclone-stream', headers={
        'origin': 'https://cyclonet-frontend-staging.onrender.com'
    }) as connection:
        assert connection.receive_json()['type'] == 'handshake'


@pytest.mark.parametrize('origin', [
    'http://localhost:3001', 'https://localhost:3001',
    'https://cyclonet-frontend.onrender.com/untrusted-path',
    'https://user@cyclonet-frontend.onrender.com',
])
def test_websocket_rejects_unconfigured_or_malformed_origins(monkeypatch, origin):
    monkeypatch.setenv('ENVIRONMENT', 'production')
    monkeypatch.setenv('ALLOWED_ORIGINS', 'https://cyclonet-frontend.onrender.com')
    assert not websocket.is_origin_allowed(origin)


def test_simulation_center_fix_never_claims_an_official_observation():
    service = LiveIngestionService()
    system = dict(id='SIM', name='Drill', lat=15, lon=85, category='Cyclonic Storm',
                  intensity_knots=40, is_simulation=True, source='Synthetic fixture')
    service._calibrate_system_telemetry(system)
    assert system['telemetry_attribution']['center_fix'] == 'SIMULATION'
    assert system['telemetry_attribution']['intensity_knots'] == 'SIMULATION'
    assert system['track_forecast'][0]['method'] == 'SIMULATION'
    assert system['track_forecast'][0]['is_observed'] is False


def test_repeated_calibration_cannot_invent_a_forecast():
    service = LiveIngestionService()
    system = dict(id='SOURCE', name='Source storm', lat=15, lon=85,
                  category='Unclassified', intensity_knots=None, is_simulation=False)
    service._calibrate_system_telemetry(system)
    original_method = system['track_generation_method']
    service._calibrate_system_telemetry(system)
    assert system['track_generation_method'] == original_method
    assert system['telemetry_attribution']['trajectory_forecast'] == 'UNAVAILABLE'


def test_archive_pagination_uses_global_chronological_order():
    from app.core.database import SessionLocal
    from app.models.domain import CycloneArchive
    ids = ['AUDIT-PAGE-OLD', 'AUDIT-PAGE-NEW', 'AUDIT-PAGE-MIDDLE']
    with SessionLocal.begin() as db:
        db.add_all([CycloneArchive(id=ident, name='AuditPagination', year=2020,
                    dates=date) for ident, date in zip(ids, ['May 1-2', 'Dec 1-2', 'Jun 1-2'])])
    try:
        pages = [TestClient(app).get('/api/history/search', params={
            'query':'AuditPagination', 'limit':1, 'offset':offset
        }).json()[0]['id'] for offset in range(3)]
        assert pages == [ids[1], ids[2], ids[0]]
    finally:
        with SessionLocal.begin() as db:
            db.query(CycloneArchive).filter(CycloneArchive.id.in_(ids)).delete(synchronize_session=False)


def test_rate_limiter_recovers_after_redis_is_unavailable_at_startup(monkeypatch):
    import runpy
    from unittest.mock import MagicMock
    import redis
    client = MagicMock()
    client.ping.side_effect = redis.ConnectionError('Startup outage')
    client.eval.side_effect = [redis.ConnectionError('Still unavailable'), [1, 29, 0, 'ok']]
    monkeypatch.setenv('REDIS_URL', 'redis://localhost:6379/0')
    monkeypatch.setenv('ENVIRONMENT', 'production')
    with patch('redis.from_url', return_value=client):
        module = runpy.run_path('app/core/rate_limit.py')
    check = module['check_redis_rate_limit']
    assert check('chat', 'recovery-client', 30, 120, 1000) is None
    assert check('chat', 'recovery-client', 30, 120, 1001) == (True, 29, 0)
