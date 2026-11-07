"""
DEMONSTRATION ONLY: Cyclone Intensity Classifier Smoke Training Script
WARNING:
This script is strictly intended for local UI development, mock data verification,
and integration testing. Weights produced by this script are UNCALIBRATED and
CANNOT be used for operational meteorological forecasting.
"""

import os
import sys
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import transforms
from torchvision.models import resnet50, ResNet50_Weights
from PIL import Image
from pathlib import Path

from train_classifier import (
    CycloneClassifierHead,
    CLASSES,
    CLASS_NAMES,
    load_seed_data,
    BASE_DIR
)

def train_demo():
    print("=" * 60)
    print("Starting DEMO Cyclone Intensity Classifier Training (UNCALIBRATED)")
    print("=" * 60)
    
    device = torch.device("cpu")
    print("Loading pretrained ResNet50 feature extractor...")
    weights = ResNet50_Weights.DEFAULT
    backbone = resnet50(weights=weights).eval()
    for param in backbone.parameters():
        param.requires_grad = False
    feature_extractor = nn.Sequential(*list(backbone.children())[:-1]).to(device)

    base_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    seed_images = load_seed_data()
    X_list, y_list = [], []

    for class_id, paths in seed_images.items():
        existing_paths = [p for p in paths if os.path.exists(p)]
        for p in existing_paths:
            try:
                raw_img = Image.open(p).convert('RGB')
                with torch.no_grad():
                    t = base_transform(raw_img).unsqueeze(0).to(device)
                    feat = feature_extractor(t).squeeze().cpu().numpy()
                    X_list.append(feat)
                    y_list.append(class_id)
            except Exception as e:
                print(f"Warning on demo image {p}: {e}")

    if not X_list:
        print("No demo images found. Aborting demo training.")
        return

    X = torch.tensor(np.array(X_list, dtype=np.float32))
    y = torch.tensor(np.array(y_list, dtype=np.int64))
    
    dataset = torch.utils.data.TensorDataset(X, y)
    loader = torch.utils.data.DataLoader(dataset, batch_size=8, shuffle=True)

    head = CycloneClassifierHead(in_features=2048, num_classes=len(CLASSES)).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(head.parameters(), lr=0.001)

    # Fast 5-epoch demo fit
    head.train()
    for epoch in range(1, 6):
        total_loss = 0.0
        for bx, by in loader:
            optimizer.zero_grad()
            out = head(bx)
            loss = criterion(out, by)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        print(f"Demo Epoch [{epoch}/5] - Loss: {total_loss:.4f}")

    output_dir = os.path.join(str(BASE_DIR), "app", "models")
    os.makedirs(output_dir, exist_ok=True)
    checkpoint_path = os.path.join(output_dir, "cyclone_classifier.pth")

    checkpoint_data = {
        'state_dict': {k: v.clone().cpu() for k, v in head.state_dict().items()},
        'classes': CLASSES,
        'class_names': CLASS_NAMES,
        'in_features': 2048,
        'num_classes': len(CLASSES),
        'best_val_acc': 0.0,
        'is_operational_certified': False,
        'uncalibrated_demo': True,
        'model_status': 'DEMONSTRATION_PROTOTYPE',
        'scientific_notice': (
            'UNCALIBRATED DEMO PROTOTYPE ONLY. Not validated for operational forecasting. '
            'Requires multi-thousand infrared raster dataset with IBTrACS ground truth.'
        )
    }

    torch.save(checkpoint_data, checkpoint_path)
    print(f"Demo weights saved to: {checkpoint_path}")
    print("DEMO PROTOTYPE READY (Explicitly uncalibrated).")

if __name__ == '__main__':
    train_demo()
