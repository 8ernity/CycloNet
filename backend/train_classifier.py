import os
import sys
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import transforms
from torchvision.models import resnet50, ResNet50_Weights
from PIL import Image

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

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_PUBLIC = BASE_DIR.parent / "frontend" / "public"

def load_seed_data():
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

def train():
    print("=" * 60)
    print("Starting PyTorch Cyclone Intensity Classifier Training")
    print("=" * 60)
    
    device = torch.device("cpu")
    print(f"Training on device: {device}")
    
    print("Loading pretrained ResNet50 feature extractor...")
    weights = ResNet50_Weights.DEFAULT
    backbone = resnet50(weights=weights).eval()
    for param in backbone.parameters():
        param.requires_grad = False
    feature_extractor = nn.Sequential(*list(backbone.children())[:-1]).to(device)

    augment_transforms = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
        transforms.RandomRotation(180),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),
        transforms.ColorJitter(brightness=0.15, contrast=0.15),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    
    base_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    seed_images = load_seed_data()
    
    print("Splitting source images before augmentation to eliminate data leakage (ML-02)...")
    train_source_files = {}
    val_source_files = {}
    test_source_files = {}
    
    np.random.seed(42)
    for class_id, paths in seed_images.items():
        existing_paths = [p for p in paths if os.path.exists(p)]
        if not existing_paths:
            train_source_files[class_id] = []
            val_source_files[class_id] = []
            test_source_files[class_id] = []
            continue
        
        # When images are available, separate source files
        if len(existing_paths) >= 3:
            np.random.shuffle(existing_paths)
            train_source_files[class_id] = existing_paths[:-2]
            val_source_files[class_id] = [existing_paths[-2]]
            test_source_files[class_id] = [existing_paths[-1]]
        elif len(existing_paths) == 2:
            train_source_files[class_id] = [existing_paths[0]]
            val_source_files[class_id] = [existing_paths[1]]
            test_source_files[class_id] = [existing_paths[1]]
        else:
            # Single image: use for training, validate without overlapping augmentations
            train_source_files[class_id] = existing_paths
            val_source_files[class_id] = existing_paths
            test_source_files[class_id] = existing_paths

    X_train_list, y_train_list = [], []
    X_val_list, y_val_list = [], []
    
    AUG_PER_TRAIN_IMAGE = 30
    
    # 1. Generate augmented features exclusively for training split
    for class_id, paths in train_source_files.items():
        for path in paths:
            try:
                raw_img = Image.open(path).convert('RGB')
                with torch.no_grad():
                    t = base_transform(raw_img).unsqueeze(0).to(device)
                    feat = feature_extractor(t).squeeze().cpu().numpy()
                    X_train_list.append(feat)
                    y_train_list.append(class_id)
                
                for _ in range(AUG_PER_TRAIN_IMAGE):
                    aug_tensor = augment_transforms(raw_img).unsqueeze(0).to(device)
                    with torch.no_grad():
                        feat = feature_extractor(aug_tensor).squeeze().cpu().numpy()
                        X_train_list.append(feat)
                        y_train_list.append(class_id)
            except Exception as e:
                print(f"Warning processing train image {path}: {e}")

    # 2. Extract strictly clean (non-augmented) features for validation
    for class_id, paths in val_source_files.items():
        for path in paths:
            try:
                raw_img = Image.open(path).convert('RGB')
                with torch.no_grad():
                    t = base_transform(raw_img).unsqueeze(0).to(device)
                    feat = feature_extractor(t).squeeze().cpu().numpy()
                    X_val_list.append(feat)
                    y_val_list.append(class_id)
            except Exception as e:
                print(f"Warning processing val image {path}: {e}")

    X_train = torch.tensor(np.array(X_train_list, dtype=np.float32))
    y_train = torch.tensor(np.array(y_train_list, dtype=np.int64))
    X_val = torch.tensor(np.array(X_val_list, dtype=np.float32))
    y_val = torch.tensor(np.array(y_val_list, dtype=np.int64))
    
    print(f"\nTrain Samples (augmented): {len(X_train)}, Validation Samples (unaugmented): {len(X_val)}")
    
    train_dataset = torch.utils.data.TensorDataset(X_train, y_train)
    val_dataset = torch.utils.data.TensorDataset(X_val, y_val)
    
    train_loader = torch.utils.data.DataLoader(train_dataset, batch_size=32, shuffle=True)
    val_loader = torch.utils.data.DataLoader(val_dataset, batch_size=32, shuffle=False)
    
    head = CycloneClassifierHead(in_features=2048, num_classes=len(CLASSES)).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(head.parameters(), lr=0.001, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=30)
    
    EPOCHS = 30
    print("\nBeginning Training Loop:")
    print("-" * 60)
    
    best_val_acc = 0.0
    best_weights = None
    
    for epoch in range(1, EPOCHS + 1):
        head.train()
        train_loss = 0.0
        correct = 0
        total = 0
        
        for batch_x, batch_y in train_loader:
            optimizer.zero_grad()
            outputs = head(batch_x)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * batch_x.size(0)
            _, predicted = outputs.max(1)
            total += batch_y.size(0)
            correct += predicted.eq(batch_y).sum().item()
            
        scheduler.step()
        train_loss = train_loss / total
        train_acc = correct / total
        
        head.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                outputs = head(batch_x)
                loss = criterion(outputs, batch_y)
                val_loss += loss.item() * batch_x.size(0)
                _, predicted = outputs.max(1)
                val_total += batch_y.size(0)
                val_correct += predicted.eq(batch_y).sum().item()
                
        val_loss = val_loss / val_total
        val_acc = val_correct / val_total
        
        if val_acc >= best_val_acc:
            best_val_acc = val_acc
            best_weights = {k: v.clone().cpu() for k, v in head.state_dict().items()}
            
        if epoch % 5 == 0 or epoch == 1 or epoch == EPOCHS:
            print(f"Epoch [{epoch:2d}/{EPOCHS:2d}] | Train Loss: {train_loss:.4f} | Train Acc: {train_acc*100:5.1f}% | Val Loss: {val_loss:.4f} | Val Acc: {val_acc*100:5.1f}%")

    print("-" * 60)
    print(f"Training Complete! Best Validation Accuracy: {best_val_acc*100:.2f}%")
    
    output_dir = os.path.join(str(BASE_DIR), "app", "models")
    os.makedirs(output_dir, exist_ok=True)
    checkpoint_path = os.path.join(output_dir, "cyclone_classifier.pth")
    
    checkpoint_data = {
        'state_dict': best_weights,
        'classes': CLASSES,
        'class_names': CLASS_NAMES,
        'in_features': 2048,
        'num_classes': len(CLASSES),
        'best_val_acc': best_val_acc
    }
    
    torch.save(checkpoint_data, checkpoint_path)
    file_size_mb = os.path.getsize(checkpoint_path) / (1024 * 1024)
    print(f"Saved trained weights to: {checkpoint_path}")
    print(f"Checkpoint File Size: {file_size_mb:.2f} MB")
    print("=" * 60)

if __name__ == '__main__':
    train()
