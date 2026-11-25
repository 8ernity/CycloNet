"""Production PyTorch cyclone intensity classifier training CLI and split verifier."""

import hashlib
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import numpy as np

from app.services.dataset_errors import InsufficientDatasetError


class DataLeakageError(Exception):
    """Raised when duplicate images or storm events are shared across train, val, or test splits."""


@dataclass
class DatasetSample:
    path: str
    class_id: int
    event_id: str
    sha256: str
    timestamp: Optional[str] = None


CLASSES = ["NOT_A_CYCLONE", "CS", "SCS", "VSCS", "ESCS"]
CLASS_NAMES = [
    "No Cyclone Detected (Non-Meteorological Image)",
    "Cyclonic Storm (CS)",
    "Severe Cyclonic Storm (SCS)",
    "Very Severe Cyclonic Storm (VSCS)",
    "Extremely Severe Cyclonic Storm (ESCS)",
]

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_PUBLIC = BASE_DIR.parent / "frontend" / "public"


def compute_file_sha256(file_path: str | Path) -> str:
    """Compute SHA-256 digest of an image file for cryptographic split verification."""
    digest = hashlib.sha256()
    with open(file_path, "rb") as stream:
        while chunk := stream.read(65536):
            digest.update(chunk)
    return digest.hexdigest()


def load_seed_data() -> Dict[int, List[str]]:
    """Return decorative demo image paths; strictly insufficient for scientific training."""
    seed_images: Dict[int, List[str]] = {
        0: [str(FRONTEND_PUBLIC / "Earth.png"), str(FRONTEND_PUBLIC / "Astronaut.png")],
        1: [str(FRONTEND_PUBLIC / "demo_frames" / "demo_1.jpg")],
        2: [str(FRONTEND_PUBLIC / "demo_frames" / "demo_2.jpg")],
        3: [str(FRONTEND_PUBLIC / "demo_frames" / "demo_3.jpg")],
        4: [str(FRONTEND_PUBLIC / "demo_frames" / "demo_4.jpg")],
    }
    user_uploaded_env = os.getenv("USER_UPLOADED_DIR")
    if user_uploaded_env and os.path.exists(user_uploaded_env):
        for fname in os.listdir(user_uploaded_env):
            if fname.lower().endswith((".png", ".jpg", ".jpeg")):
                seed_images[0].append(os.path.join(user_uploaded_env, fname))
    return seed_images


def verify_dataset_manifest(
    train_samples: List[DatasetSample],
    val_samples: List[DatasetSample],
    test_samples: List[DatasetSample],
) -> None:
    """Verify cryptographic hash and event ID disjointness across train/val/test splits."""
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
    seed: int = 42,
) -> Tuple[List[DatasetSample], List[DatasetSample], List[DatasetSample]]:
    """Partition dataset samples strictly by independent storm event across train/val/test."""
    events: Dict[str, List[DatasetSample]] = {}
    class_events: Dict[int, Set[str]] = {}
    required_events = max(3, min_events_per_class)

    for class_id, samples in sorted(samples_by_class.items()):
        class_events[class_id] = set()
        for sample in samples:
            if not sample.event_id:
                raise InsufficientDatasetError("Independent event IDs are required")
            events.setdefault(sample.event_id, []).append(sample)
            class_events[class_id].add(sample.event_id)
        if len(class_events[class_id]) < required_events:
            raise InsufficientDatasetError(
                f"Class {class_id} has insufficient independent events; a minimum of "
                f"{required_events} independent events is required"
            )
    if not events:
        raise InsufficientDatasetError("No independent events supplied")

    rng = np.random.default_rng(seed)
    event_labels = {event: {s.class_id for s in rows} for event, rows in events.items()}
    labels = sorted(class_events, key=lambda label: (len(class_events[label]), label))

    for _ in range(256):
        assignment: Dict[str, int] = {}
        covered: List[Set[int]] = [set(), set(), set()]
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
            assignment[event] = int(rng.choice(3, p=[0.6, 0.2, 0.2]))
        train_split: List[DatasetSample] = []
        val_split: List[DatasetSample] = []
        test_split: List[DatasetSample] = []
        splits_list = [train_split, val_split, test_split]
        for event in sorted(events):
            splits_list[assignment[event]].extend(sorted(events[event], key=lambda s: (s.class_id, s.path)))
        verify_dataset_manifest(train_split, val_split, test_split)
        return train_split, val_split, test_split

    raise InsufficientDatasetError("Cannot assign whole storms with every class in all three splits")


def train(*args, **kwargs):
    from app.services.training_pipeline import run_training

    return run_training(*args, **kwargs)


def inspect_demo_seed_data() -> None:
    """Explicit non-scientific demo entry point; rejects insufficient seed data."""
    seed_images = load_seed_data()
    samples_by_class: Dict[int, List[DatasetSample]] = {}
    for class_id, paths in seed_images.items():
        samples_by_class[class_id] = [
            DatasetSample(
                path=p,
                class_id=class_id,
                event_id=f"event_{Path(p).stem}",
                sha256=compute_file_sha256(p),
            )
            for p in paths
            if os.path.exists(p)
        ]
    partition_dataset_strictly_disjoint(samples_by_class, min_events_per_class=3)


if __name__ == "__main__":
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
    except InsufficientDatasetError as exc:
        print(f"\n[INSUFFICIENT_DATASET_HALT] {exc}")
        print("Production training halted safely to prevent unscientific model fabrication.")
        sys.exit(1)
