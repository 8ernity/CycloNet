"""
Production PyTorch Cyclone Intensity Classifier Training Pipeline
Scientific Validation Standard:
- Event-based disjoint partitioning
- Cryptographic SHA-256 manifest tracking
- Zero spatial/temporal data leakage between train/val/test splits
"""

import os
import sys
import hashlib
from dataclasses import dataclass
from typing import Dict, List, Tuple, Set, Optional
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import transforms
from torchvision.models import resnet50, ResNet50_Weights
from PIL import Image

from app.services.dataset_errors import InsufficientDatasetError

class DataLeakageError(Exception):
    """Raised when duplicate images or storm events are shared across train, val, or test splits."""
    pass

@dataclass
class DatasetSample:
    path: str
    class_id: int
    event_id: str
    sha256: str
    timestamp: Optional[str] = None

class CycloneClassifierHead(nn.Module):
    def __init__(self, in_features=2048, num_classes=5):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_features, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(),
            nn.Dropout(0.4),
            nn.Linear(512, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, num_classes)
        )

    def forward(self, x):
        return self.net(x)

CLASSES = ['NOT_A_CYCLONE', 'CS', 'SCS', 'VSCS', 'ESCS']
CLASS_NAMES = [
    'No Cyclone Detected (Non-Meteorological Image)',
    'Cyclonic Storm (CS)',
    'Severe Cyclonic Storm (SCS)',
    'Very Severe Cyclonic Storm (VSCS)',
    'Extremely Severe Cyclonic Storm (ESCS)'
]

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_PUBLIC = BASE_DIR.parent / "frontend" / "public"

def compute_file_sha256(file_path: str) -> str:
    """Computes SHA-256 digest of an image file for cryptographic split verification."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def load_seed_data() -> Dict[int, List[str]]:
    """Loads demo image paths. Note: This seed dataset is insufficient for scientific training."""
    seed_images = {
        0: [
            str(FRONTEND_PUBLIC / "Earth.png"),
            str(FRONTEND_PUBLIC / "Astronaut.png"),
        ],
        1: [
            str(FRONTEND_PUBLIC / "demo_frames" / "demo_1.jpg"),
        ],
        2: [
            str(FRONTEND_PUBLIC / "demo_frames" / "demo_2.jpg"),
        ],
        3: [
            str(FRONTEND_PUBLIC / "demo_frames" / "demo_3.jpg"),
        ],
        4: [
            str(FRONTEND_PUBLIC / "demo_frames" / "demo_4.jpg"),
        ]
    }
    
    user_uploaded_env = os.getenv("USER_UPLOADED_DIR")
    if user_uploaded_env and os.path.exists(user_uploaded_env):
        for f in os.listdir(user_uploaded_env):
            if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                full_p = os.path.join(user_uploaded_env, f)
                seed_images[0].append(full_p)
                
    return seed_images

def verify_dataset_manifest(
    train_samples: List[DatasetSample],
    val_samples: List[DatasetSample],
    test_samples: List[DatasetSample]
) -> None:
    """
    Verifies cryptographic hash and event ID disjointness across splits.
    Raises DataLeakageError if any duplicate is found.
    """
    train_hashes = {s.sha256 for s in train_samples}
    val_hashes = {s.sha256 for s in val_samples}
    test_hashes = {s.sha256 for s in test_samples}

    if not train_hashes.isdisjoint(val_hashes):
        overlap = train_hashes.intersection(val_hashes)
        raise DataLeakageError(f"Data leakage detected: {len(overlap)} image(s) shared between TRAIN and VAL splits.")
    if not train_hashes.isdisjoint(test_hashes):
        overlap = train_hashes.intersection(test_hashes)
        raise DataLeakageError(f"Data leakage detected: {len(overlap)} image(s) shared between TRAIN and TEST splits.")
    if not val_hashes.isdisjoint(test_hashes):
        overlap = val_hashes.intersection(test_hashes)
        raise DataLeakageError(f"Data leakage detected: {len(overlap)} image(s) shared between VAL and TEST splits.")

    train_events = {s.event_id for s in train_samples if s.event_id}
    val_events = {s.event_id for s in val_samples if s.event_id}
    test_events = {s.event_id for s in test_samples if s.event_id}

    if not train_events.isdisjoint(val_events):
        overlap = train_events.intersection(val_events)
        raise DataLeakageError(f"Event leakage detected: Storm event(s) {overlap} shared between TRAIN and VAL splits.")
    if not train_events.isdisjoint(test_events):
        overlap = train_events.intersection(test_events)
        raise DataLeakageError(f"Event leakage detected: Storm event(s) {overlap} shared between TRAIN and TEST splits.")
    if not val_events.isdisjoint(test_events):
        overlap = val_events.intersection(test_events)
        raise DataLeakageError(f"Event leakage detected: Storm event(s) {overlap} shared between VAL and TEST splits.")

def partition_dataset_strictly_disjoint(
    samples_by_class: Dict[int, List[DatasetSample]],
    min_events_per_class: int = 3,
    seed: int = 42
) -> Tuple[List[DatasetSample], List[DatasetSample], List[DatasetSample]]:
    """
    Partitions dataset samples strictly by independent storm event.
    Guarantees:
    - Minimum `min_events_per_class` independent events per class.
    - Zero image content (hash) overlap across splits.
    - Zero event ID overlap across splits.
    - Raises InsufficientDatasetError if requirements are not met.
    """
    # A storm changes intensity over its lifetime. Assign the event once globally,
    # never independently for each class. Input ordering must not change assignment.
    events = {}
    class_events = {}
    for class_id, samples in sorted(samples_by_class.items()):
        class_events[class_id] = set()
        for sample in samples:
            if not sample.event_id:
                raise InsufficientDatasetError('Independent event IDs are required')
            events.setdefault(sample.event_id, []).append(sample)
            class_events[class_id].add(sample.event_id)
        if len(class_events[class_id]) < max(3, min_events_per_class):
            raise InsufficientDatasetError(
                f'Class {class_id} has insufficient independent events; a minimum of '
                f'{max(3, min_events_per_class)} independent events is required')
    if not events:
        raise InsufficientDatasetError('No independent events supplied')
    rng = np.random.default_rng(seed)
    event_labels = {event: {s.class_id for s in rows} for event, rows in events.items()}
    labels = sorted(class_events, key=lambda label: (len(class_events[label]), label))
    for _ in range(256):
        assignment, covered = {}, [set(), set(), set()]
        failed = False
        for label in labels:
            for split in range(3):
                if label in covered[split]:
                    continue
                candidates = sorted(class_events[label] - assignment.keys())
                if not candidates:
                    failed = True
                    break
                rng.shuffle(candidates)
                event = max(candidates, key=lambda e: len(event_labels[e] - covered[split]))
                assignment[event] = split
                covered[split].update(event_labels[event])
            if failed:
                break
        if failed:
            continue
        for event in sorted(events.keys() - assignment.keys()):
            assignment[event] = int(rng.choice(3, p=[.6, .2, .2]))
        splits = tuple([] for _ in range(3))
        for event in sorted(events):
            splits[assignment[event]].extend(sorted(events[event], key=lambda s: (s.class_id, s.path)))
        verify_dataset_manifest(*splits)
        return splits
    raise InsufficientDatasetError('Cannot assign whole storms with every class in all three splits')

def train(*args, **kwargs):
    from app.services.training_pipeline import run_training
    return run_training(*args, **kwargs)


def inspect_demo_seed_data():
    """
    Production training entry point.
    Rejects insufficient or uncalibrated seed data with InsufficientDatasetError.
    """
    print("=" * 60)
    print("Starting PyTorch Cyclone Intensity Classifier Training (Scientific Standard)")
    print("=" * 60)

    seed_images = load_seed_data()
    samples_by_class: Dict[int, List[DatasetSample]] = {}

    for class_id, paths in seed_images.items():
        existing_paths = [p for p in paths if os.path.exists(p)]
        samples_by_class[class_id] = []
        for p in existing_paths:
            h = compute_file_sha256(p)
            # For seed demo files, each file is a separate artifact
            event_id = f"event_{Path(p).stem}"
            samples_by_class[class_id].append(
                DatasetSample(path=p, class_id=class_id, event_id=event_id, sha256=h)
            )

    # Strictly disjoint partitioning; raises InsufficientDatasetError on seed data
    train_samples, val_samples, test_samples = partition_dataset_strictly_disjoint(
        samples_by_class, min_events_per_class=3
    )

    print(f"Dataset verified: Train={len(train_samples)}, Val={len(val_samples)}, Test={len(test_samples)}")
    print("Disjoint partitioning passed all verification checks.")

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description="Train from a versioned independent-event manifest")
    parser.add_argument("manifest", nargs="?")
    parser.add_argument("--output-dir", default="artifacts/research")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    try:
        train(args.manifest, args.output_dir, epochs=args.epochs, batch_size=args.batch_size, seed=args.seed)
    except InsufficientDatasetError as e:
        print(f"\n[INSUFFICIENT_DATASET_HALT] {e}")
        print("Production training halted safely to prevent unscientific model fabrication.")
        sys.exit(1)
