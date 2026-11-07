import hashlib
import json
from pathlib import Path
import pytest
import torch
from PIL import Image
from train_classifier import train, InsufficientDatasetError
from app.services.ml_service import CycloneIntensityService

def test_missing_scientific_manifest_halts():
    with pytest.raises(InsufficientDatasetError, match='BLOCKED_EXTERNAL_DATASET'):
        train()

def test_synthetic_training_optimizes_exports_and_infers(tmp_path, monkeypatch):
    samples = []
    for label in range(5):
        for event in range(3):
            path = tmp_path / f'{label}-{event}.png'
            Image.new('RGB', (24, 24), (label*40, event*70, 100)).save(path)
            samples.append(dict(path=path.name, class_id=label, event_id=f'{label}-{event}',
                                sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    manifest = tmp_path / 'manifest.json'
    manifest.write_text(json.dumps(dict(dataset_version='synthetic-test-v1', synthetic=True, samples=samples)))
    torch.set_num_threads(2)
    output = train(manifest, tmp_path/'output', epochs=1, batch_size=5, pretrained='NONE', demo=True)
    assert output['parameters_changed']
    assert Path(output['checkpoint']).exists()
    service = CycloneIntensityService()
    service.checkpoint_path = output['checkpoint']
    service.load_model()
    assert service.checkpoint_loaded
    assert not service.scientifically_validated
    prediction = service.predict((tmp_path/'0-0.png').read_bytes())
    assert prediction['model_type'] == 'DEMO'
    assert not prediction['is_reliable']
    # Exercise the validation trust configuration with test-only metadata.
    # These synthetic weights are never promoted outside this temporary fixture.
    artifact = torch.load(output['checkpoint'], weights_only=True)
    artifact['metadata'].update(demo_model=False, scientifically_validated=True,
        model_status='VALIDATED', validation_reference='test-only-independent-evidence')
    artifact.update(uncalibrated_demo=False, model_status='VALIDATED')
    fixture = tmp_path/'validation-contract.pth'
    torch.save(artifact, fixture)
    untrusted = CycloneIntensityService()
    untrusted.checkpoint_path = str(fixture)
    untrusted.load_model()
    assert untrusted.checkpoint_loaded and not untrusted.scientifically_validated
    monkeypatch.setenv('VALIDATED_MODEL_CHECKSUMS', artifact['metadata']['checkpoint_checksum'])
    trusted = CycloneIntensityService()
    trusted.checkpoint_path = str(fixture)
    trusted.load_model()
    assert trusted.checkpoint_loaded and trusted.scientifically_validated
