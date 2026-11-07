import os
import pytest
import tempfile
from unittest.mock import patch
from PIL import Image

from train_classifier import (
    InsufficientDatasetError,
    DataLeakageError,
    DatasetSample,
    compute_file_sha256,
    partition_dataset_strictly_disjoint,
    verify_dataset_manifest,
    train as run_production_train
)

def test_single_image_per_class_raises_insufficient_dataset_error():
    """
    Test 1: If a class has only 1 image / event, scientific partitioning MUST
    raise InsufficientDatasetError and NEVER duplicate images into train/val/test splits.
    """
    samples_by_class = {
        0: [DatasetSample(path="dummy_0.jpg", class_id=0, event_id="event_0", sha256="hash_0")],
        1: [DatasetSample(path="dummy_1.jpg", class_id=1, event_id="event_1", sha256="hash_1")],
        2: [DatasetSample(path="dummy_2.jpg", class_id=2, event_id="event_2", sha256="hash_2")],
        3: [DatasetSample(path="dummy_3.jpg", class_id=3, event_id="event_3", sha256="hash_3")],
        4: [DatasetSample(path="dummy_4.jpg", class_id=4, event_id="event_4", sha256="hash_4")]
    }

    with pytest.raises(InsufficientDatasetError) as excinfo:
        partition_dataset_strictly_disjoint(samples_by_class, min_events_per_class=3)
    
    assert "minimum of 3 independent events" in str(excinfo.value).lower()

def test_fewer_than_min_events_raises_insufficient_dataset_error():
    """
    Test 2: Two independent events per class is still insufficient for a 3-way disjoint split (train, val, test).
    """
    samples_by_class = {
        0: [
            DatasetSample(path="d0_a.jpg", class_id=0, event_id="ev_0_a", sha256="h0a"),
            DatasetSample(path="d0_b.jpg", class_id=0, event_id="ev_0_b", sha256="h0b"),
        ]
    }
    with pytest.raises(InsufficientDatasetError):
        partition_dataset_strictly_disjoint(samples_by_class, min_events_per_class=3)

def test_duplicate_image_hashes_across_splits_raises_data_leakage_error():
    """
    Test 3: If identical image SHA-256 hashes appear in both train and validation splits,
    verify_dataset_manifest must detect data leakage and raise DataLeakageError.
    """
    shared_hash = "abc123def456"
    train_samples = [
        DatasetSample(path="img1.jpg", class_id=1, event_id="ev_1", sha256=shared_hash)
    ]
    val_samples = [
        DatasetSample(path="img2.jpg", class_id=1, event_id="ev_2", sha256=shared_hash)
    ]
    test_samples = [
        DatasetSample(path="img3.jpg", class_id=1, event_id="ev_3", sha256="unique_test_hash")
    ]

    with pytest.raises(DataLeakageError) as excinfo:
        verify_dataset_manifest(train_samples, val_samples, test_samples)
    
    assert "data leakage detected" in str(excinfo.value).lower()

def test_shared_event_ids_across_splits_raises_data_leakage_error():
    """
    Test 4: Even if images have different hashes (e.g. consecutive satellite frames from the same storm),
    sharing the same event_id between train and test constitutes temporal data leakage and must be rejected.
    """
    train_samples = [
        DatasetSample(path="f1.jpg", class_id=1, event_id="CYCLONE_AMPHAN_2020", sha256="h1")
    ]
    val_samples = [
        DatasetSample(path="f2.jpg", class_id=1, event_id="CYCLONE_FANI_2019", sha256="h2")
    ]
    test_samples = [
        # Same storm as train, different frame!
        DatasetSample(path="f3.jpg", class_id=1, event_id="CYCLONE_AMPHAN_2020", sha256="h3")
    ]

    with pytest.raises(DataLeakageError) as excinfo:
        verify_dataset_manifest(train_samples, val_samples, test_samples)

    assert "event leakage detected" in str(excinfo.value).lower()

def test_valid_disjoint_events_partition_successfully_without_leakage():
    """
    Test 5: When >= 3 independent events exist with multi-frame observations,
    partitioning produces mutually disjoint splits with 0% data or event leakage.
    """
    samples_by_class = {
        0: [
            DatasetSample(path=f"img_0_{ev}_{frame}.jpg", class_id=0, event_id=f"ev_0_{ev}", sha256=f"h_0_{ev}_{frame}")
            for ev in range(4)
            for frame in range(3)
        ]
    }

    train_s, val_s, test_s = partition_dataset_strictly_disjoint(samples_by_class, min_events_per_class=3)

    train_hashes = {s.sha256 for s in train_s}
    val_hashes = {s.sha256 for s in val_s}
    test_hashes = {s.sha256 for s in test_s}

    train_events = {s.event_id for s in train_s}
    val_events = {s.event_id for s in val_s}
    test_events = {s.event_id for s in test_s}

    assert train_hashes.isdisjoint(val_hashes)
    assert train_hashes.isdisjoint(test_hashes)
    assert val_hashes.isdisjoint(test_hashes)

    assert train_events.isdisjoint(val_events)
    assert train_events.isdisjoint(test_events)
    assert val_events.isdisjoint(test_events)

    assert len(test_events) >= 1
    assert len(val_events) >= 1
    assert len(train_events) >= 1

def test_train_classifier_train_halts_safely_on_seed_data():
    """
    Test 6: Invoking train_classifier.train() on the default seed demonstration data
    must halt immediately with InsufficientDatasetError instead of running unscientific training.
    """
    with pytest.raises(InsufficientDatasetError):
        run_production_train()
