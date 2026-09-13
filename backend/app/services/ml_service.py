import io
import os
import numpy as np
import torch
import torch.nn as nn
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

class CycloneIntensityService:
    def __init__(self):
        self.device = torch.device("cpu")
        weights = ResNet50_Weights.DEFAULT
        backbone = resnet50(weights=weights).eval()
        for param in backbone.parameters():
            param.requires_grad = False
        self.feature_extractor = nn.Sequential(*list(backbone.children())[:-1]).to(self.device)
        
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        
        self.checkpoint_path = "D:/Projects/CycloneTracker/backend/app/models/cyclone_classifier.pth"
        self.load_model()

    def load_model(self):
        if os.path.exists(self.checkpoint_path):
            checkpoint = torch.load(self.checkpoint_path, map_location=self.device)
            self.classes = checkpoint['classes']
            self.class_names = checkpoint['class_names']
            self.head = CycloneClassifierHead(in_features=checkpoint['in_features'], num_classes=checkpoint['num_classes']).to(self.device)
            self.head.load_state_dict(checkpoint['state_dict'])
            self.head.eval()
            self.has_model = True
            print(f"Loaded trained PyTorch weights from: {self.checkpoint_path}")
        else:
            self.has_model = False
            print(f"Warning: Checkpoint not found at {self.checkpoint_path}")

    def predict(self, image_bytes: bytes):
        """Runs genuine PyTorch forward pass inference with softmax confidence scores."""
        if not self.has_model:
            self.load_model()
            
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        t = self.transform(img).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            feat = self.feature_extractor(t).squeeze(2).squeeze(2)
            logits = self.head(feat)
            probs = torch.softmax(logits, dim=1).squeeze().cpu().numpy()
            pred_idx = int(np.argmax(probs))
            conf = float(probs[pred_idx]) * 100.0
            
        pred_class = self.classes[pred_idx]
        pred_name = self.class_names[pred_idx]
        is_cyclone = (pred_class != 'NOT_A_CYCLONE')
        
        knots_map = {
            'NOT_A_CYCLONE': 0,
            'CS': 45,
            'SCS': 60,
            'VSCS': 80,
            'ESCS': 105
        }
        
        dvorak_map = {
            'NOT_A_CYCLONE': 'N/A',
            'CS': 'T3.0',
            'SCS': 'T3.5',
            'VSCS': 'T4.5',
            'ESCS': 'T5.5'
        }
        
        return {
            'is_cyclone': is_cyclone,
            'category': pred_name,
            'category_short': pred_class if is_cyclone else 'NOT A CYCLONE',
            'confidence': round(conf, 2),
            'dvorak_t': dvorak_map.get(pred_class, 'N/A'),
            'wind_speed_knots': knots_map.get(pred_class, 0),
            'overlay_url': '/mock-overlay.png' if is_cyclone else None,
            'probabilities': {
                self.classes[i]: round(float(probs[i]) * 100.0, 2) for i in range(len(self.classes))
            }
        }

ml_service = CycloneIntensityService()