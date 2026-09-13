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

def load_seed_data():
    seed_images = {
        0: [
            'D:/Projects/CycloneTracker/frontend/public/file.svg',
            'D:/Projects/CycloneTracker/frontend/public/globe.svg',
        ],
        1: [
            'D:/Projects/CycloneTracker/frontend/public/demo_frames/demo_1.jpg',
        ],
        2: [
            'D:/Projects/CycloneTracker/frontend/public/demo_frames/demo_2.jpg',
        ],
        3: [
            'D:/Projects/CycloneTracker/frontend/public/demo_frames/demo_3.jpg',
        ],
        4: [
            'D:/Projects/CycloneTracker/frontend/public/demo_frames/demo_4.jpg',
            'D:/Projects/CycloneTracker/frontend/public/demo_frames/demo_4.jpg',
        ]
    }
    
    uploaded_dir = 'C:/Users/arpan/.gemini/antigravity-ide/brain/31f289fb-67a6-41a2-9cf4-d26f79e2f8e0/.user_uploaded'
    if os.path.exists(uploaded_dir):
        for f in os.listdir(uploaded_dir):
            if f.endswith(('.png', '.jpg')) and '1789318050559' not in f:
                full_p = os.path.join(uploaded_dir, f)
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
    
    print("Generating augmented training dataset from seed imagery...")
    X_list = []
    y_list = []
    
    AUG_PER_SEED = 30
    
    for class_id, paths in seed_images.items():
        count = 0
        for path in paths:
            if not os.path.exists(path):
                continue
            try:
                raw_img = Image.open(path).convert('RGB')
                with torch.no_grad():
                    t = base_transform(raw_img).unsqueeze(0).to(device)
                    feat = feature_extractor(t).squeeze().cpu().numpy()
                    X_list.append(feat)
                    y_list.append(class_id)
                    count += 1
                
                for _ in range(AUG_PER_SEED):
                    aug_tensor = augment_transforms(raw_img).unsqueeze(0).to(device)
                    with torch.no_grad():
                        feat = feature_extractor(aug_tensor).squeeze().cpu().numpy()
                        X_list.append(feat)
                        y_list.append(class_id)
                        count += 1
            except Exception as e:
                print(f"Warning processing {path}: {e}")
                
        print(f"Class {class_id} ({CLASSES[class_id]}): {count} training samples")

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.int64)
    
    print(f"\nTotal Dataset Size: {len(X)} samples, feature dimension: {X.shape[1]}")
    
    indices = np.arange(len(X))
    np.random.seed(42)
    np.random.shuffle(indices)
    
    split_idx = int(0.85 * len(X))
    train_idx, val_idx = indices[:split_idx], indices[split_idx:]
    
    X_train, y_train = torch.tensor(X[train_idx]), torch.tensor(y[train_idx])
    X_val, y_val = torch.tensor(X[val_idx]), torch.tensor(y[val_idx])
    
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
            best_weights = head.state_dict().copy()
            
        if epoch % 5 == 0 or epoch == 1 or epoch == EPOCHS:
            print(f"Epoch [{epoch:2d}/{EPOCHS:2d}] | Train Loss: {train_loss:.4f} | Train Acc: {train_acc*100:5.1f}% | Val Loss: {val_loss:.4f} | Val Acc: {val_acc*100:5.1f}%")

    print("-" * 60)
    print(f"Training Complete! Best Validation Accuracy: {best_val_acc*100:.2f}%")
    
    output_dir = 'D:/Projects/CycloneTracker/backend/app/models'
    os.makedirs(output_dir, exist_ok=True)
    checkpoint_path = os.path.join(output_dir, 'cyclone_classifier.pth')
    
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
