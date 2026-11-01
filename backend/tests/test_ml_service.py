import pytest
import io
from PIL import Image
from app.services.ml_service import ml_service

def test_ml_service_initialization():
    """Verify ML classifier model architecture and label mappings."""
    assert ml_service.feature_extractor is not None
    assert len(ml_service.classes) == 5
    assert "CS" in ml_service.classes
    assert "ESCS" in ml_service.classes

def test_ml_service_image_prediction():
    """Verify PyTorch inference pipeline on a synthetic 224x224 RGB image buffer."""
    # Create synthetic test image
    img = Image.new("RGB", (224, 224), color=(73, 109, 137))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    img_bytes = buf.getvalue()
    
    result = ml_service.predict(img_bytes)
    assert "category" in result
    assert "confidence" in result
    assert "category_short" in result
    assert "is_cyclone" in result
    assert "probabilities" in result
    assert len(result["probabilities"]) == 5
