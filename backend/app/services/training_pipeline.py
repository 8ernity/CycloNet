"""Reproducible training and evaluation; metrics alone never confer scientific validation."""
import copy
import json
import random
from dataclasses import asdict
from pathlib import Path
import numpy as np
import torch
from torch import nn
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from torchvision.models import resnet50, ResNet50_Weights
from PIL import Image
from app.models.checkpoint import CheckpointMetadata, weights_checksum
from app.services.ml_service import CycloneClassifierHead


class Images(Dataset):
    def __init__(self, samples, augment=False):
        self.samples = samples
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            *([transforms.RandomHorizontalFlip()] if augment else []),
            transforms.ToTensor(),
            transforms.Normalize([.485, .456, .406], [.229, .224, .225]),
        ])

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        sample = self.samples[index]
        with Image.open(sample.path) as image:
            return self.transform(image.convert('RGB')), sample.class_id


def run_training(manifest_path=None, output_dir='artifacts', *, epochs=20, batch_size=16,
                 patience=4, seed=42, pretrained='IMAGENET1K_V2', demo=False):
    from train_classifier import (DatasetSample, CLASSES, CLASS_NAMES, compute_file_sha256,
                                 partition_dataset_strictly_disjoint, verify_dataset_manifest,
                                 InsufficientDatasetError)
    if not manifest_path:
        raise InsufficientDatasetError('BLOCKED_EXTERNAL_DATASET: a versioned independent-event manifest is required')
    manifest_path = Path(manifest_path)
    if manifest_path.suffix.lower() == '.csv':
        from app.services.scientific_manifest import load_training_csv
        manifest = load_training_csv(manifest_path)
    else:
        manifest = json.loads(manifest_path.read_text())
    version = manifest.get('dataset_version')
    if not isinstance(version, str) or not version.strip():
        raise ValueError('Dataset version required')
    if manifest.get('synthetic') and not demo:
        raise ValueError('Synthetic data requires demo=True')
    if pretrained not in ('IMAGENET1K_V2', 'NONE') or (pretrained == 'NONE' and not demo):
        raise ValueError('Scientific training requires explicitly pretrained ResNet-50')
    if epochs < 1 or batch_size < 2 or patience < 1:
        raise ValueError('Invalid optimization configuration')
    samples_by_class = {i: [] for i in range(len(CLASSES))}
    assigned_splits = {name: [] for name in ('train', 'validation', 'test')}
    explicit_splits = any('split' in row for row in manifest['samples'])
    for row in manifest['samples']:
        label = row['class_id']
        if type(label) is not int or label not in samples_by_class or not row.get('event_id'):
            raise ValueError('Invalid class label or missing independent event ID')
        path = (manifest_path.parent / row['path']).resolve()
        if not path.is_file() or compute_file_sha256(path) != row['sha256']:
            raise ValueError(f'Missing image or checksum mismatch: {path.name}')
        sample = DatasetSample(str(path), label, row['event_id'], row['sha256'], row.get('timestamp'))
        samples_by_class[label].append(sample)
        if explicit_splits:
            if row.get('split') not in assigned_splits:
                raise ValueError('Every sample must have a valid frozen split')
            assigned_splits[row['split']].append(sample)
    if explicit_splits:
        splits = tuple(assigned_splits.values())
        verify_dataset_manifest(*splits)
        if any({s.class_id for s in split} != set(range(len(CLASSES))) for split in splits):
            raise InsufficientDatasetError('Every frozen split must contain all classes from independent events')
    else:
        splits = partition_dataset_strictly_disjoint(samples_by_class, seed=seed)
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.use_deterministic_algorithms(True)
    backbone = resnet50(weights=None if pretrained == 'NONE' else ResNet50_Weights.IMAGENET1K_V2).eval()
    for param in backbone.parameters():
        param.requires_grad = False
    feature_extractor = nn.Sequential(*list(backbone.children())[:-1])
    head = CycloneClassifierHead(num_classes=len(CLASSES))
    initial = {name: param.detach().clone() for name, param in head.named_parameters()}
    optimizer = torch.optim.AdamW(head.parameters(), lr=.001)
    criterion = nn.CrossEntropyLoss()
    loaders = [DataLoader(Images(split, augment=(i == 0)), batch_size=batch_size,
                          shuffle=(i == 0), num_workers=0, drop_last=False)
               for i, split in enumerate(splits)]

    def evaluate(loader):
        head.eval()
        loss_total, correct, count = 0., 0, 0
        confusion = torch.zeros(len(CLASSES), len(CLASSES), dtype=torch.int64)
        with torch.no_grad():
            for images, labels in loader:
                logits = head(feature_extractor(images).flatten(1))
                loss_total += criterion(logits, labels).item() * len(labels)
                predictions = logits.argmax(1)
                correct += (predictions == labels).sum().item()
                count += len(labels)
                for label, prediction in zip(labels, predictions):
                    confusion[label, prediction] += 1
        return dict(loss=loss_total/count, accuracy=correct/count, count=count,
                    confusion_matrix=confusion.tolist())

    history, best, bad_epochs, selected = [], float('inf'), 0, None
    for epoch in range(epochs):
        head.train()
        loss_total, count = 0., 0
        for images, labels in loaders[0]:
            # BatchNorm needs two samples in training mode; use running statistics
            # for a final singleton, without discarding or duplicating the image.
            if len(labels) == 1:
                head.eval()
            else:
                head.train()
            with torch.no_grad():
                features = feature_extractor(images).flatten(1)
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(head(features), labels)
            loss.backward()
            optimizer.step()
            loss_total += loss.item()*len(labels)
            count += len(labels)
        val = evaluate(loaders[1])
        history.append(dict(epoch=epoch+1, train_loss=loss_total/count, validation=val))
        if val['loss'] < best:
            best, bad_epochs = val['loss'], 0
            selected = copy.deepcopy(head.state_dict())
        else:
            bad_epochs += 1
            if bad_epochs >= patience:
                break
    head.load_state_dict(selected)
    test = evaluate(loaders[2])  # test split is touched only after checkpoint selection
    changed = any(not torch.equal(initial[name], param) for name, param in head.named_parameters())
    states = {'backbone': backbone.state_dict(), 'head': head.state_dict()}
    checksum = weights_checksum(states)
    metadata = CheckpointMetadata(
        model_id='cyclonet-resnet50', model_version=f'{version}-{checksum[:12]}',
        architecture='resnet50+cyclone-head-v1', class_mapping=CLASSES,
        training_dataset_version=version, evaluation_dataset_version=f'{version}:independent-test',
        training_complete=True, scientifically_validated=False, checkpoint_checksum=checksum,
        demo_model=demo, model_status='UNCALIBRATED_DEMO' if demo else 'TRAINED_EXPERIMENTAL')
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    checkpoint = output_dir / f'{metadata.model_version}.pth'
    torch.save(dict(metadata=metadata.model_dump(), state_dict=states['head'], backbone_state_dict=states['backbone'],
                    classes=CLASSES, class_names=CLASS_NAMES, num_classes=len(CLASSES),
                    uncalibrated_demo=demo, model_status=metadata.model_status), checkpoint)
    metrics = dict(seed=seed, pretrained=pretrained, history=history, test=test,
                   parameters_changed=changed, checkpoint=str(checkpoint.resolve()),
                   metadata=metadata.model_dump(),
                   splits={name:[asdict(s) for s in split] for name,split in zip(['train','validation','test'],splits)})
    (output_dir/'metrics.json').write_text(json.dumps(metrics, indent=2))
    return metrics
