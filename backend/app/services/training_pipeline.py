"""Reproducible training and evaluation; metrics alone never confer scientific validation."""

import copy
import json
import random
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np


def _load_manifest(manifest_path: Path, demo: bool, pretrained: str, epochs: int, batch_size: int, patience: int) -> Dict[str, Any]:
    if manifest_path.suffix.lower() == ".csv":
        from app.services.scientific_manifest import load_training_csv

        manifest = load_training_csv(manifest_path)
    else:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    version = manifest.get("dataset_version")
    if not isinstance(version, str) or not version.strip():
        raise ValueError("Dataset version required")
    if manifest.get("synthetic") and not demo:
        raise ValueError("Synthetic data requires demo=True")
    if pretrained not in ("IMAGENET1K_V2", "NONE") or (pretrained == "NONE" and not demo):
        raise ValueError("Scientific training requires explicitly pretrained ResNet-50")
    if epochs < 1 or batch_size < 2 or patience < 1:
        raise ValueError("Invalid optimization configuration")
    return manifest


def _prepare_splits(manifest: Dict[str, Any], manifest_path: Path, seed: int) -> Tuple[List[Any], List[Any], List[Any]]:
    from train_classifier import (
        CLASSES,
        DatasetSample,
        InsufficientDatasetError,
        compute_file_sha256,
        partition_dataset_strictly_disjoint,
        verify_dataset_manifest,
    )

    samples_by_class: Dict[int, List[DatasetSample]] = {i: [] for i in range(len(CLASSES))}
    assigned_splits: Dict[str, List[DatasetSample]] = {"train": [], "validation": [], "test": []}
    explicit_splits = any("split" in row for row in manifest["samples"])

    for row in manifest["samples"]:
        label = row["class_id"]
        if type(label) is not int or label not in samples_by_class or not row.get("event_id"):
            raise ValueError("Invalid class label or missing independent event ID")
        path = (manifest_path.parent / row["path"]).resolve()
        if not path.is_file() or compute_file_sha256(path) != row["sha256"]:
            raise ValueError(f"Missing image or checksum mismatch: {path.name}")
        sample = DatasetSample(str(path), label, row["event_id"], row["sha256"], row.get("timestamp"))
        samples_by_class[label].append(sample)
        if explicit_splits:
            split_name = row.get("split")
            if split_name not in assigned_splits:
                raise ValueError("Every sample must have a valid frozen split")
            assigned_splits[split_name].append(sample)

    if explicit_splits:
        splits = (assigned_splits["train"], assigned_splits["validation"], assigned_splits["test"])
        verify_dataset_manifest(*splits)
        if any({s.class_id for s in split} != set(range(len(CLASSES))) for split in splits):
            raise InsufficientDatasetError("Every frozen split must contain all classes from independent events")
        return splits

    return partition_dataset_strictly_disjoint(samples_by_class, seed=seed)


def _evaluate_loader(head: Any, feature_extractor: Any, loader: Any, criterion: Any, classes: List[str]) -> Dict[str, Any]:
    import torch

    from app.services.evaluation import ClassificationMetrics

    head.eval()
    loss_total, count = 0.0, 0
    metrics = ClassificationMetrics(classes)
    with torch.no_grad():
        for images, labels in loader:
            logits = head(feature_extractor(images).flatten(1))
            loss_total += criterion(logits, labels).item() * len(labels)
            count += len(labels)
            metrics.update(logits.softmax(1).cpu().numpy(), labels.cpu().numpy())
    return dict(loss=loss_total / count, **metrics.result())


def _train_one_epoch(head: Any, feature_extractor: Any, loader: Any, optimizer: Any, criterion: Any) -> float:
    import torch

    loss_total, count = 0.0, 0
    for images, labels in loader:
        # BatchNorm needs two samples in training mode; preserve singletons via eval statistics.
        head.eval() if len(labels) == 1 else head.train()
        with torch.no_grad():
            features = feature_extractor(images).flatten(1)
        optimizer.zero_grad(set_to_none=True)
        loss = criterion(head(features), labels)
        loss.backward()
        optimizer.step()
        loss_total += loss.item() * len(labels)
        count += len(labels)
    return loss_total / count


def resnet50(*args: Any, **kwargs: Any) -> Any:
    """Lazy wrapper preserving `patch('app.services.training_pipeline.resnet50')` in tests."""
    from torchvision.models import resnet50 as _resnet50

    return _resnet50(*args, **kwargs)


def run_training(
    manifest_path=None,
    output_dir="artifacts",
    *,
    epochs=20,
    batch_size=16,
    patience=4,
    seed=42,
    pretrained="IMAGENET1K_V2",
    demo=False,
):
    from app.services.image_leakage import verify_image_content_splits
    from train_classifier import CLASS_NAMES, CLASSES, InsufficientDatasetError

    if not manifest_path:
        raise InsufficientDatasetError("BLOCKED_EXTERNAL_DATASET: a versioned independent-event manifest is required")

    manifest_file = Path(manifest_path)
    manifest = _load_manifest(manifest_file, demo, pretrained, epochs, batch_size, patience)
    splits = _prepare_splits(manifest, manifest_file, seed)
    content_review = verify_image_content_splits(splits)

    # Defer heavy PyTorch/torchvision imports until dataset validation has succeeded.
    import torch
    from PIL import Image
    from torch import nn
    from torch.utils.data import DataLoader, Dataset
    from torchvision import transforms
    from torchvision.models import ResNet50_Weights

    from app.models.checkpoint import CheckpointMetadata, weights_checksum
    from app.services.ml_service import CycloneClassifierHead

    class _Images(Dataset):
        def __init__(self, samples: List[Any], augment: bool = False) -> None:
            self.samples = samples
            self.transform = transforms.Compose(
                [
                    transforms.Resize((224, 224)),
                    *([transforms.RandomHorizontalFlip()] if augment else []),
                    transforms.ToTensor(),
                    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
                ]
            )

        def __len__(self) -> int:
            return len(self.samples)

        def __getitem__(self, index: int):
            sample = self.samples[index]
            with Image.open(sample.path) as image:
                return self.transform(image.convert("RGB")), sample.class_id

    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.use_deterministic_algorithms(True)

    backbone = resnet50(weights=None if pretrained == "NONE" else ResNet50_Weights.IMAGENET1K_V2).eval()
    for param in backbone.parameters():
        param.requires_grad = False
    feature_extractor = nn.Sequential(*list(backbone.children())[:-1])
    head = CycloneClassifierHead(num_classes=len(CLASSES))
    initial = {name: param.detach().clone() for name, param in head.named_parameters()}
    optimizer = torch.optim.AdamW(head.parameters(), lr=0.001)
    criterion = nn.CrossEntropyLoss()
    loaders = [
        DataLoader(_Images(split, augment=(i == 0)), batch_size=batch_size, shuffle=(i == 0), num_workers=0, drop_last=False)
        for i, split in enumerate(splits)
    ]

    history, best_loss, bad_epochs, selected = [], float("inf"), 0, None
    for epoch in range(epochs):
        train_loss = _train_one_epoch(head, feature_extractor, loaders[0], optimizer, criterion)
        val_metrics = _evaluate_loader(head, feature_extractor, loaders[1], criterion, CLASSES)
        history.append({"epoch": epoch + 1, "train_loss": train_loss, "validation": val_metrics})
        if val_metrics["loss"] < best_loss:
            best_loss, bad_epochs = val_metrics["loss"], 0
            selected = copy.deepcopy(head.state_dict())
        else:
            bad_epochs += 1
            if bad_epochs >= patience:
                break

    if selected is not None:
        head.load_state_dict(selected)
    test_metrics = _evaluate_loader(head, feature_extractor, loaders[2], criterion, CLASSES)
    changed = any(not torch.equal(initial[name], param) for name, param in head.named_parameters())

    version = manifest["dataset_version"]
    states = {"backbone": backbone.state_dict(), "head": head.state_dict()}
    checksum = weights_checksum(states)
    metadata = CheckpointMetadata(
        model_id="cyclonet-resnet50",
        model_version=f"{version}-{checksum[:12]}",
        architecture="resnet50+cyclone-head-v1",
        class_mapping=CLASSES,
        training_dataset_version=version,
        evaluation_dataset_version=f"{version}:independent-test",
        training_complete=True,
        scientifically_validated=False,
        checkpoint_checksum=checksum,
        demo_model=demo,
        model_status="UNCALIBRATED_DEMO" if demo else "TRAINED_EXPERIMENTAL",
    )

    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    checkpoint = out_path / f"{metadata.model_version}.pth"
    torch.save(
        {
            "metadata": metadata.model_dump(),
            "state_dict": states["head"],
            "backbone_state_dict": states["backbone"],
            "classes": CLASSES,
            "class_names": CLASS_NAMES,
            "num_classes": len(CLASSES),
            "uncalibrated_demo": demo,
            "model_status": metadata.model_status,
        },
        checkpoint,
    )
    metrics = {
        "seed": seed,
        "pretrained": pretrained,
        "history": history,
        "test": test_metrics,
        "image_content_review": content_review,
        "ood_evaluation": {
            "status": "NOT_EVALUATED",
            "reason": "A separate independently reviewed OOD image benchmark is required; class 0 test accuracy is not an OOD evaluation",
        },
        "parameters_changed": changed,
        "checkpoint": str(checkpoint.resolve()),
        "metadata": metadata.model_dump(),
        "splits": {name: [asdict(s) for s in split] for name, split in zip(["train", "validation", "test"], splits, strict=True)},
    }
    (out_path / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics
