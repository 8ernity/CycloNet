import hashlib
import json
from unittest.mock import patch
import numpy as np
import pytest
from PIL import Image, PngImagePlugin
from train_classifier import train, DataLeakageError
from train_classifier import DatasetSample, InsufficientDatasetError
from app.services.image_leakage import verify_image_content_splits


@pytest.mark.parametrize('near_duplicate', [False, True])
def test_reencoded_or_near_duplicate_cross_split_stops_before_backbone(tmp_path, near_duplicate):
    samples = []
    rng = np.random.default_rng(82)
    original = rng.integers(20, 230, (32,32,3), dtype=np.uint8)
    for split in ['train', 'validation', 'test']:
        for label in range(5):
            pixels = rng.integers(20, 230, (32,32,3), dtype=np.uint8)
            if label == 0 and split in ['train', 'test']:
                pixels = original.copy()
                if split == 'test' and near_duplicate:
                    pixels = pixels + 1
            metadata = PngImagePlugin.PngInfo()
            metadata.add_text('fixture', split)
            path = tmp_path / f'{split}-{label}.png'
            Image.fromarray(pixels).save(path, pnginfo=metadata)
            samples.append(dict(path=path.name, split=split, class_id=label,
                event_id=f'{split}-{label}', sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    path = tmp_path/'manifest.json'
    path.write_text(json.dumps(dict(dataset_version='leakage-fixture', synthetic=True, samples=samples)))
    with patch('app.services.training_pipeline.resnet50',side_effect=AssertionError('Training began before content leakage review')):
        with pytest.raises(DataLeakageError, match='image content'):
            train(path, tmp_path/'output', epochs=1, batch_size=5, pretrained='NONE', demo=True)


def test_same_split_copies_do_not_cross_contaminate(tmp_path):
    path=tmp_path/'one.png'
    Image.new('RGB',(32,32),(10,20,30)).save(path)
    sample=DatasetSample(str(path),0,'one',hashlib.sha256(path.read_bytes()).hexdigest())
    result=verify_image_content_splits(([sample,sample],[],[]))
    assert result['images_checked']==2
    assert result['candidate_comparisons']==0


def test_content_screen_budget_fails_closed(tmp_path,monkeypatch):
    import app.services.image_leakage as screen
    monkeypatch.setattr(screen,'MAX_COMPARISONS',0)
    samples=[]
    for index in range(2):
        values=np.random.default_rng(index).integers(20,230,(32,32,3),dtype=np.uint8)
        # Identical channel means but different spatial content; candidate comparison required.
        if index: values=np.flip(original,axis=0).copy()
        else: original=values
        path=tmp_path/f'{index}.png'
        Image.fromarray(values).save(path)
        samples.append(DatasetSample(str(path),0,str(index),hashlib.sha256(path.read_bytes()).hexdigest()))
    with pytest.raises(InsufficientDatasetError,match='budget exceeded'):
        verify_image_content_splits(([samples[0]],[samples[1]],[]))
