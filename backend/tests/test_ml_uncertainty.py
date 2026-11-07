import io
import pytest
import numpy as np
import torch
from unittest.mock import patch, MagicMock
from PIL import Image

from app.services.ml_service import CycloneIntensityService, validate_image_payload

def create_test_image_bytes(color=(100, 150, 200)) -> bytes:
    img = Image.new("RGB", (224, 224), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

def test_ml_uninitialized_returns_checkpoint_not_loaded_and_experimental_status():
    service = CycloneIntensityService()
    service._has_model = False
    service.model_initialized = True

    img_bytes = create_test_image_bytes()
    res = service.predict(img_bytes)

    assert res['status'] == 'CHECKPOINT_NOT_LOADED'
    assert res['confidence_status'] == 'INSUFFICIENT_CONFIDENCE'
    assert res['is_reliable'] is False
    assert res['operational_status'] == 'EXPERIMENTAL'
    assert res['is_cyclone'] is False

def test_ml_high_entropy_triggers_insufficient_confidence_and_abstains():
    service = CycloneIntensityService()
    service._has_model = True
    service.model_initialized = True
    service.backbone = MagicMock()
    service.head = MagicMock()

    # Simulate nearly uniform logits across 5 classes -> high entropy (~1.0), low MSP (~0.20)
    uniform_logits = torch.tensor([[1.0, 1.01, 0.99, 1.0, 1.02]])
    service.head.return_value = uniform_logits
    
    with patch.object(service, '_extract_features', return_value=torch.zeros((1, 2048, 7, 7))):
        img_bytes = create_test_image_bytes()
        res = service.predict(img_bytes)

    assert res['status'] == 'INSUFFICIENT_CONFIDENCE'
    assert res['confidence_status'] == 'INSUFFICIENT_CONFIDENCE'
    assert res['is_abstained'] is True
    assert res['is_reliable'] is False
    assert res['operational_status'] == 'EXPERIMENTAL'
    assert res['normalized_entropy'] > 0.65
    assert res['msp'] < 0.60
    assert "human meteorological inspection" in res['recommendation'].lower()

def test_ml_low_msp_triggers_insufficient_confidence_and_abstains():
    service = CycloneIntensityService()
    service._has_model = True
    service.model_initialized = True
    service.backbone = MagicMock()
    service.head = MagicMock()

    # Logits where top-1 is only ~45% (below 60% MSP floor)
    logits = torch.tensor([[0.5, 2.0, 1.8, 0.3, 0.1]])
    service.head.return_value = logits

    with patch.object(service, '_extract_features', return_value=torch.zeros((1, 2048, 7, 7))):
        img_bytes = create_test_image_bytes()
        res = service.predict(img_bytes)

    assert res['status'] == 'INSUFFICIENT_CONFIDENCE'
    assert res['confidence_status'] == 'INSUFFICIENT_CONFIDENCE'
    assert res['is_abstained'] is True
    assert res['msp'] < 0.60

def test_ml_confident_prediction_reports_calibrated_metrics_and_experimental_status():
    service = CycloneIntensityService()
    service._has_model = True
    service.model_initialized = True
    service.backbone = MagicMock()
    service.head = MagicMock()

    # Sharp logits -> high MSP (>0.90), low entropy (<0.30), large margin (>0.80)
    sharp_logits = torch.tensor([[-5.0, -5.0, 10.0, -5.0, -5.0]])
    service.head.return_value = sharp_logits

    with patch.object(service, '_extract_features', return_value=torch.zeros((1, 2048, 7, 7))):
        with patch.object(service, '_compute_gradcam', return_value="data:image/png;base64,mock"):
            img_bytes = create_test_image_bytes()
            res = service.predict(img_bytes)

    assert res['status'] == 'SUCCESS'
    assert res['confidence_status'] == 'HIGH_CONFIDENCE'
    assert res['is_abstained'] is False
    assert res['is_reliable'] is False
    assert res['scientifically_validated'] is False
    assert res['model_type'] == 'DEMO'
    assert res['operational_status'] == 'EXPERIMENTAL'
    assert res['msp'] > 0.90
    assert res['margin'] > 0.80
    assert res['normalized_entropy'] < 0.40
    assert res['category_short'] == 'SCS'

def test_validation_rejects_non_image_payloads():
    with pytest.raises(ValueError) as exc:
        validate_image_payload(b"NOT_AN_IMAGE_PAYLOAD")
    assert "unsupported format" in str(exc.value).lower()
