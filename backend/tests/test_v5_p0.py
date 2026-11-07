import io
import xml.etree.ElementTree as ET
from unittest.mock import patch

import pytest
import torch
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.api.routes import SystemResponse, TrackPoint
from app.services.report_service import report_service
from app.services.ml_service import CycloneIntensityService
from app.services.live_ingestion import LiveIngestionService

SYSTEM = dict(id='real', name='Test', basin='Bay of Bengal', lat=15, lon=85,
              category='Unclassified', intensity_knots=None,
              track_forecast=[dict(lat=15, lon=85, time_offset_hours=0,
                                   category='Unclassified', intensity_knots=None)])

def test_nullable_wind_http_and_track():
    with patch.object(LiveIngestionService, 'live_systems', new_callable=__import__('unittest.mock', fromlist=['PropertyMock']).PropertyMock, return_value=[SYSTEM]):
        response = TestClient(app).get('/api/active-systems')
    assert response.status_code == 200
    assert response.json()[0]['intensity_knots'] is None
    assert response.json()[0]['track_forecast'][0]['intensity_knots'] is None

def test_missing_wind_cannot_create_hazard():
    assert report_service.get_alert_level(None)['level'] == 'DATA_UNAVAILABLE'
    assert report_service.get_port_signals(None, True) == []
    xml = ET.fromstring(report_service.generate_cap_xml(SYSTEM))
    ns = {'c': 'urn:oasis:names:tc:emergency:cap:1.2'}
    assert xml.findtext('c:status', namespaces=ns) == 'Exercise'
    assert xml.findtext('c:info/c:severity', namespaces=ns) == 'Unknown'

def test_reports_never_invent_official_bulletins():
    bulletins = report_service.generate_experimental_analysis(SYSTEM)
    assert len(bulletins) == 1
    assert bulletins[0]['intensity_knots'] is None
    assert 'INDIA METEOROLOGICAL' not in bulletins[0]['full_text']
    assert bulletins[0]['timestamp_utc'] is None

def test_no_storm_does_not_implicitly_select_demo():
    with patch.object(LiveIngestionService, 'live_systems', new_callable=__import__('unittest.mock', fromlist=['PropertyMock']).PropertyMock, return_value=[]):
        assert TestClient(app).get('/api/reports/bulletins').status_code == 503

def test_high_confidence_demo_is_not_reliable():
    service = CycloneIntensityService()
    service.model_initialized = True
    service.has_model = True
    service.head = lambda x: torch.tensor([[100., 0., 0., 0., 0.]])
    service.backbone = type('Backbone', (), {'avgpool': lambda self, x: x})()
    service._extract_features = lambda x: torch.zeros(1, 5)
    buffer = io.BytesIO()
    Image.new('RGB', (16, 16)).save(buffer, format='PNG')
    prediction = service.predict(buffer.getvalue())
    assert prediction['is_reliable'] is False
    assert prediction['scientifically_validated'] is False
    assert prediction['model_type'] == 'DEMO'

def test_telemetry_validation_and_zero():
    assert SystemResponse(**{**SYSTEM, 'intensity_knots': 0}).intensity_knots == 0
    for field, value in [('intensity_knots', -1), ('central_pressure_hpa', -1), ('lat', 95), ('observation_time_utc', 'not a date')]:
        with pytest.raises(ValueError):
            SystemResponse(**{**SYSTEM, field: value})
