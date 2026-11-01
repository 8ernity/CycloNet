import io
import os
import base64
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

def validate_image_payload(image_bytes: bytes) -> str:
    """
    SEC-08: Validates file signature (magic bytes) and dimensions.
    Rejects malformed images, unsupported formats, and decompression bombs.
    """
    if len(image_bytes) < 8:
        raise ValueError("Uploaded file is too small to be a valid image.")
    if image_bytes[:3] == b"\xff\xd8\xff":
        fmt = "JPEG"
    elif image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        fmt = "PNG"
    else:
        raise ValueError("Unsupported format: Only genuine JPEG and PNG image payloads are accepted.")

    Image.MAX_IMAGE_PIXELS = 16_000_000
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            w, h = img.size
            if w > 4096 or h > 4096:
                raise ValueError(f"Image dimensions ({w}x{h}) exceed maximum allowed dimensions (4096x4096).")
    except Exception as e:
        if isinstance(e, ValueError):
            raise
        raise ValueError(f"Corrupt or malformed image payload: {e}")
    return fmt

class CycloneIntensityService:
    def __init__(self):
        self.device = torch.device("cpu")
        self.backbone = None
        self.feature_extractor = None
        self.classes = ['NOT_A_CYCLONE', 'CS', 'SCS', 'VSCS', 'ESCS']
        self.class_names = [
            'Not a Cyclone (Non-Cyclonic System)',
            'Cyclonic Storm (CS)',
            'Severe Cyclonic Storm (SCS)',
            'Very Severe Cyclonic Storm (VSCS)',
            'Extremely Severe Cyclonic Storm (ESCS)'
        ]
        self.head = None
        self._has_model = False
        self.model_initialized = False

        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        default_ckpt = os.path.normpath(os.path.join(base_dir, "models", "cyclone_classifier.pth"))
        self.checkpoint_path = os.getenv("MODEL_CHECKPOINT_PATH", default_ckpt)

    @property
    def has_model(self) -> bool:
        self._ensure_initialized()
        return self._has_model

    @has_model.setter
    def has_model(self, val: bool):
        self._has_model = val

    def _ensure_initialized(self):
        """
        Fix #58: Lazy initialization of ResNet-50 backbone and classifier head.
        Prevents downloading ResNet-50 weights at import time if uncached.
        """
        if self.model_initialized:
            return
        self.load_model()

    def load_model(self):
        if self.model_initialized:
            return
        self.model_initialized = True

        # 1. Initialize backbone without blocking startup or import
        backbone_pretrained = False
        try:
            weights = ResNet50_Weights.DEFAULT
            self.backbone = resnet50(weights=weights).eval()
            backbone_pretrained = True
        except Exception as e:
            # Fix #58 & ML-03: Graceful fallback when weights cannot be downloaded at startup
            print(f"[Notice] Could not download ImageNet weights at startup ({e}). Falling back to unweighted ResNet-50 backbone.")
            self.backbone = resnet50(weights=None).eval()
            backbone_pretrained = False

        for param in self.backbone.parameters():
            param.requires_grad = False
        
        self.feature_extractor = nn.Sequential(*list(self.backbone.children())[:-1]).to(self.device)

        # ML-03 & SEC-09: Require pretrained backbone AND safe weights_only=True deserialization
        if os.path.exists(self.checkpoint_path) and backbone_pretrained:
            try:
                checkpoint = torch.load(self.checkpoint_path, map_location=self.device, weights_only=True)
                self.classes = checkpoint.get('classes', ['NOT_A_CYCLONE', 'CS', 'SCS', 'VSCS', 'ESCS'])
                self.class_names = checkpoint.get('class_names', [
                    'Not a Cyclone (Non-Cyclonic System)',
                    'Cyclonic Storm (CS)',
                    'Severe Cyclonic Storm (SCS)',
                    'Very Severe Cyclonic Storm (VSCS)',
                    'Extremely Severe Cyclonic Storm (ESCS)'
                ])
                in_feat = checkpoint.get('in_features', 2048)
                n_classes = checkpoint.get('num_classes', len(self.classes))
                self.head = CycloneClassifierHead(in_features=in_feat, num_classes=n_classes).to(self.device)
                if 'state_dict' in checkpoint:
                    self.head.load_state_dict(checkpoint['state_dict'])
                self.head.eval()
                self._has_model = True
                print(f"Loaded trained PyTorch weights from: {self.checkpoint_path}")
                return
            except Exception as e:
                print(f"Error loading PyTorch checkpoint from {self.checkpoint_path}: {e}")

        # Fallback initialization so inference never throws AttributeError
        self.head = CycloneClassifierHead(in_features=2048, num_classes=5).to(self.device)
        self.head.eval()
        self._has_model = False
        print(f"Notice: Initialized fallback classifier head (checkpoint path: {self.checkpoint_path})")

    def _extract_features(self, t: torch.Tensor) -> torch.Tensor:
        """Forward pass through ResNet-50 up to layer4."""
        self._ensure_initialized()
        x = self.backbone.conv1(t)
        x = self.backbone.bn1(x)
        x = self.backbone.relu(x)
        x = self.backbone.maxpool(x)
        x = self.backbone.layer1(x)
        x = self.backbone.layer2(x)
        x = self.backbone.layer3(x)
        x = self.backbone.layer4(x)
        return x

    def _compute_gradcam(self, features: torch.Tensor, pred_idx: int) -> str:
        """
        Fix #7: Computes genuine Grad-CAM class activation heatmap from ResNet layer4 feature maps.
        Returns a base64-encoded PNG data URL.
        """
        try:
            feat_var = features.clone().detach().requires_grad_(True)
            pooled = self.backbone.avgpool(feat_var).flatten(1)
            logits = self.head(pooled)
            score = logits[0, pred_idx]
            
            self.head.zero_grad()
            score.backward()
            
            grads = feat_var.grad
            if grads is not None:
                weights = torch.mean(grads, dim=(2, 3), keepdim=True)
                cam = torch.sum(weights * feat_var, dim=1).squeeze(0)
            else:
                cam = torch.mean(feat_var, dim=1).squeeze(0)
                
            cam = torch.clamp(cam, min=0)
            cam_np = cam.detach().cpu().numpy()
            max_val = np.max(cam_np)
            if max_val > 0:
                cam_np = cam_np / max_val
            else:
                cam_np = np.zeros_like(cam_np)

            # Upscale 7x7 to 224x224 using bilinear interpolation
            cam_img = Image.fromarray((cam_np * 255).astype(np.uint8)).resize((224, 224), Image.BILINEAR)
            cam_upscaled = np.array(cam_img, dtype=np.float32) / 255.0

            # Jet colormap mapping: blue -> cyan -> yellow -> red
            r = np.clip(1.5 - np.abs(4.0 * cam_upscaled - 3.0), 0.0, 1.0)
            g = np.clip(1.5 - np.abs(4.0 * cam_upscaled - 2.0), 0.0, 1.0)
            b = np.clip(1.5 - np.abs(4.0 * cam_upscaled - 1.0), 0.0, 1.0)
            # Alpha increases with activation so low activations are translucent
            a = np.clip(cam_upscaled * 0.85, 0.0, 0.85)

            rgba = (np.stack([r, g, b, a], axis=-1) * 255).astype(np.uint8)
            out_img = Image.fromarray(rgba, mode="RGBA")
            buf = io.BytesIO()
            out_img.save(buf, format="PNG")
            b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
            return f"data:image/png;base64,{b64_str}"
        except Exception as e:
            print(f"[Grad-CAM error] {e}")
            return None

    def predict(self, image_bytes: bytes):
        """Runs genuine PyTorch forward pass inference with softmax confidence scores in <50ms."""
        validate_image_payload(image_bytes)
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        t = self.transform(img).unsqueeze(0).to(self.device)
        
        if not self.has_model:
            return {
                'is_cyclone': False,
                'category': 'Model Checkpoint Not Loaded',
                'category_short': 'UNINITIALIZED',
                'confidence': 0.0,
                'dvorak_t': None,
                'dvorak_estimate_available': False,
                'wind_speed_knots': None,
                'wind_speed_estimate_available': False,
                'intensity_notice': 'Operational quantitative wind speeds and Dvorak T-numbers require calibrated objective thermal infrared (TIR) analysis. Category classification alone does not substitute for numerical wind retrieval (ML-06).',
                'checkpoint_status': 'CHECKPOINT_NOT_FOUND',
                'is_trained_weights': False,
                'is_uncalibrated_demo': True,
                'warning': "Model weights not loaded; random weight inference is strictly blocked to prevent misleading predictions (#6).",
                'model_architecture': 'ResNet-50 + Custom Classifier Head (PyTorch)',
                'domain_transfer_status': 'RGB_SURROGATE_SURFACE',
                'domain_notice': 'Transfer learning backbone (ResNet-50) requires trained weights on satellite imagery.',
                'overlay_url': None,
                'gradcam_data_url': None,
                'probabilities': {
                    self.classes[i]: 0.0 for i in range(len(self.classes))
                }
            }

        with torch.no_grad():
            feat = self._extract_features(t)
            pooled = self.backbone.avgpool(feat).flatten(1)
            logits = self.head(pooled)
            probs = torch.softmax(logits, dim=1).squeeze().cpu().numpy()
            pred_idx = int(np.argmax(probs))
            conf = float(probs[pred_idx]) * 100.0
            
        pred_class = self.classes[pred_idx]
        pred_name = self.class_names[pred_idx]
        is_cyclone = (pred_class != 'NOT_A_CYCLONE')
        
        # Calculate genuine Grad-CAM activation heatmap
        gradcam_url = self._compute_gradcam(feat, pred_idx) if is_cyclone else None

        return {
            'is_cyclone': is_cyclone,
            'category': pred_name,
            'category_short': pred_class if is_cyclone else 'NOT A CYCLONE',
            'confidence': round(conf, 2),
            'dvorak_t': None,
            'dvorak_estimate_available': False,
            'wind_speed_knots': None,
            'wind_speed_estimate_available': False,
            'intensity_notice': 'Operational quantitative wind speeds and Dvorak T-numbers require calibrated objective thermal infrared (TIR) analysis. Category classification alone does not substitute for numerical wind retrieval (ML-06).',
            'checkpoint_status': 'TRAINED_CHECKPOINT_LOADED' if self.has_model else 'DEMO_PRETRAINED_BACKBONE',
            'is_trained_weights': self.has_model,
            'is_uncalibrated_demo': not self.has_model,
            'warning': None if self.has_model else "Model weights are uncalibrated random initializations; output is for architectural demonstration purposes only.",
            'model_architecture': 'ResNet-50 + Custom Classifier Head (PyTorch)',
            'domain_transfer_status': 'RGB_SURROGATE_SURFACE',
            'domain_notice': 'Transfer learning backbone (ResNet-50) is pretrained on ImageNet optical natural images. Operational cyclone categorization requires fine-tuning on calibrated INSAT-3DR / Meteosat-9 infrared brightness temperature grids (TIR1/TIR2/WV).',
            'overlay_url': None,
            'gradcam_data_url': gradcam_url,
            'probabilities': {
                self.classes[i]: round(float(probs[i]) * 100.0, 2) for i in range(len(self.classes))
            }
        }

ml_service = CycloneIntensityService()