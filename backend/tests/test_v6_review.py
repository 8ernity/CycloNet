import json
import subprocess
import sys
from pathlib import Path
from unittest.mock import AsyncMock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.auth import make_test_token
from app.services.gee_service import gee_service


def test_runoff_scenario_does_not_claim_measured_terrain_or_road_state():
    paths = gee_service.get_catchment_rainfall_pathways(19.2, 85.1, 300)
    for path in paths:
        assert path.get('terrain_source') == 'ASSUMED_SCENARIO'
        assert path.get('scientifically_validated') is False
        assert path['road_crossings_impacted'] == []
        for point in path['critical_choke_points']:
            assert point['status'] == 'UNVERIFIED'
            assert point['is_simulation'] is True


def test_training_cli_reports_external_data_block_without_traceback():
    root = Path(__file__).resolve().parents[1]
    result = subprocess.run([sys.executable, 'train_classifier.py',
        'data/manifests/cyclonet_ni_scientific_v1.csv'], cwd=root,
        capture_output=True, text=True, timeout=60)
    assert result.returncode == 1
    assert 'BLOCKED_EXTERNAL_DATASET' in result.stdout
    assert 'Traceback' not in result.stderr


@pytest.mark.parametrize('role', [None, 'member', 'analyst', 'operator', 'admin'])
@pytest.mark.parametrize('method,path,body,access', [
    ('POST', '/api/ingest/sync', None, 'admin'),
    ('POST', '/api/ingest/test-inject', None, 'admin'),
    ('POST', '/api/ingest/clear-test', None, 'admin'),
    ('GET', '/api/history/classifications', None, 'member'),
    ('POST', '/api/alerts/dispatch', {'region':'Fixture'}, 'operator'),
    ('POST', '/api/alerts/broadcast-test', {}, 'operator'),
])
def test_protected_endpoint_authorization_matrix(role, method, path, body, access, monkeypatch):
    from app.services.live_ingestion import live_ingestion_service
    monkeypatch.setattr(live_ingestion_service, 'sync_all_sources', AsyncMock(return_value={'status':'fixture'}))
    monkeypatch.setattr(live_ingestion_service, 'inject_test_system', lambda **kwargs: {})
    monkeypatch.setattr(live_ingestion_service, 'clear_live_systems', lambda: None)
    headers = {'Authorization':'Bearer '+make_test_token(sub='matrix-'+str(role),role=role)} if role else {}
    response = TestClient(app).request(method, path, json=body, headers=headers)
    permitted = role is not None and (access=='member' or role=='admin' or access=='operator' and role=='operator')
    expected = 200 if permitted else 401 if role is None or access=='admin' else 403
    assert response.status_code == expected, response.text
