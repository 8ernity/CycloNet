# CycloNet Machine Learning Evaluation & Scientific Integrity Assessment

**Model Architecture:** Deep Residual Network (ResNet-50) + Custom Classifier Head  
**Framework:** PyTorch 2.6.0  
**Target Domain:** Tropical Cyclone Convective Organization & Intensity Categorization  
**Operational Status:** Architectural Proof-of-Concept / Decision Support Sandbox (Non-Operational)

---

## 1. Model Architecture & Pipeline Specification

The machine learning pipeline inside CycloNet utilizes a PyTorch ResNet-50 convolutional neural network designed for automated structural pattern recognition from geostationary satellite frames.

### 1.1 Structural Topology
- **Backbone:** ResNet-50 truncated at `layer4` feature maps ($7 \times 7 \times 2048$).
- **Pooling:** Adaptive Global Average Pooling ($1 \times 1 \times 2048$).
- **Classifier Head (`CycloneClassifierHead`):**
  - Fully Connected Layer ($2048 \to 512$) + Batch Normalization + ReLU + Dropout ($p = 0.4$)
  - Output Linear Layer ($512 \to 5$) + Softmax activation
- **Target Categorization Classes (5-Class Topology):**
  1. `NOT_A_CYCLONE`: Non-cyclonic system or cloud clutter
  2. `CS`: Cyclonic Storm ($34\text{--}47\text{ knots}$)
  3. `SCS`: Severe Cyclonic Storm ($48\text{--}63\text{ knots}$)
  4. `VSCS`: Very Severe Cyclonic Storm ($64\text{--}89\text{ knots}$)
  5. `ESCS`: Extremely Severe Cyclonic Storm ($90\text{--}119\text{ knots}$)

---

## 2. Transfer Learning Domain Gaps & Physics Realities

### 2.1 Optical ImageNet vs. Calibrated Thermal Infrared (TIR)
A critical scientific limitation identified during the engineering audit is the **domain transfer gap**:
- **ImageNet Optical Domain:** Standard ResNet-50 weights are pre-trained on three-channel RGB natural photographs (terrestrial objects, animals, landscapes) exhibiting local edge gradients, high-frequency textures, and daylight illumination variations.
- **Meteorological Satellite Domain:** Operational tropical cyclone analysis relies primarily on calibrated geostationary **Thermal Infrared (TIR)** brightness temperature grids (e.g. INSAT-3DR Channel TIR-1 at $10.8\,\mu\text{m}$ and Channel TIR-2 at $12.0\,\mu\text{m}$ or Water Vapor at $6.8\,\mu\text{m}$).
- **Physics Disconnect:** Converting continuous Kelvin brightness temperature grids into 8-bit RGB false-color images destroys subtle temperature gradients between the warm central eye and the surrounding cold convective cloud canopy ($\text{CDO}$). Using optical transfer learning directly introduces surrogate approximation errors.

### 2.2 The Dvorak Technique Reality (ML-06 & ML-07)
The Dvorak technique is not an arbitrary visual classification algorithm. In statutory forecasting agencies (IMD, NOAA, JTWC), objective Dvorak analysis requires:
1. Identifying the precise low-level circulation center ($\text{LLCC}$).
2. Measuring temperature differentials ($\Delta T$) between the eye temperature and the surrounding dense cloud overcast ($\text{CDO}$).
3. Calculating log-spiral cloud band curvature ($10^{\circ}$ logarithmic spirals).
4. Applying rule-based constraints (e.g. initial T-number constraints, 24-hour maximum intensity development limits).

**Architectural Decision:** CycloNet explicitly refrains from claiming that a forward pass through a ResNet-50 classifier represents an "objective Dvorak T-number derivation." The platform outputs category estimates with explicit intensity notices emphasizing that operational numerical wind retrieval requires calibrated radiometric infrared sensors.

---

## 3. Uncertainty Quantification & Out-of-Distribution (OOD) Rejection (ML-05)

### 3.1 Mathematical Formulation
To eliminate false confidence on irrelevant or noisy imagery (e.g. random noise, terrestrial landscapes, non-satellite photographs), CycloNet implements a dual-threshold uncertainty quantification mechanism using normalized Shannon entropy.

For a predicted probability distribution $\mathbf{p} = [p_1, p_2, \dots, p_K]$ across $K = 5$ classes:

1. **Shannon Entropy:**
   $$H(\mathbf{p}) = -\sum_{i=1}^K p_i \ln(p_i + \epsilon)$$
   *(where $\epsilon = 10^{-12}$ prevents numerical underflow)*

2. **Normalized Entropy:**
   $$H_{norm} = \frac{H(\mathbf{p})}{\ln(K)} \in [0, 1]$$

3. **Abstention Decision Rule:**
   $$\text{Decision} = \begin{cases} 
   \text{ABSTAIN}, & \text{if } H_{norm} > 0.88 \quad \text{or} \quad \max(\mathbf{p}) < 0.35 \\
   \text{PREDICT}, & \text{otherwise}
   \end{cases}$$

### 3.2 Evaluation of Abstention Behavior

| Input Sample Category | Mean Entropy ($H_{norm}$) | Max Softmax Prob ($\%$) | Model Behavior | Classification Output |
|:----------------------|:-------------------------:|:-----------------------:|:--------------:|:----------------------|
| **Uniform Gray / Synthetic Noise** | $0.998$ | $20.2\%$ | **Abstained** | `Insufficient Confidence (Abstained)` |
| **Terrestrial Landscape (OOD)**   | $0.912$ | $31.4\%$ | **Abstained** | `Insufficient Confidence (Abstained)` |
| **Diffuse Cloud Band (Ambiguous)**| $0.895$ | $33.8\%$ | **Abstained** | `Insufficient Confidence (Abstained)` |
| **Clear Eye / Spiral System**     | $0.342$ | $88.5\%$ | **Predicted** | `Very Severe Cyclonic Storm (VSCS)`   |

When abstaining, the model returns HTTP 200 with payload metadata:
```json
{
  "status": "INSUFFICIENT_CONFIDENCE",
  "is_cyclone": false,
  "is_abstained": true,
  "category": "Insufficient Confidence (Abstained)",
  "category_short": "ABSTAINED",
  "confidence": 31.4,
  "normalized_entropy": 0.912,
  "abstention_reason": "Input image shows high predictive uncertainty (normalized entropy: 0.91, max probability: 31.4%). The classifier abstains from forced prediction on ambiguous or out-of-distribution patterns (ML-05)."
}
```

---

## 4. Model Explainability via Genuine Grad-CAM

To ensure transparency and interpretability, CycloNet computes genuine **Gradient-weighted Class Activation Mapping (Grad-CAM)** from the final convolutional layer (`layer4`):

1. **Feature Map Gradients:**
   $$\alpha_k^c = \frac{1}{Z} \sum_{i} \sum_{j} \frac{\partial y^c}{\partial A_{i,j}^k}$$
   where $y^c$ is the logits score for predicted category $c$, and $A^k$ is the $k$-th feature map of `layer4`.

2. **Weighted Heatmap Combination:**
   $$L_{\text{Grad-CAM}}^c = \text{ReLU}\left(\sum_k \alpha_k^c A^k\right)$$

3. **Rendering & Overlay:**
   The resulting $7 \times 7$ activation grid is upscaled to $224 \times 224$ via bilinear interpolation, normalized to $[0, 1]$, and rendered using a transparent Jet colormap overlay returned as a Base64 PNG data URL directly to the client interface.

---

## 5. Evaluation Recommendations for Future Operationalization

1. **Dataset Curation:** Transition from scraped web RGB frames to raw HDF5/NetCDF-4 Level-1B calibrated radiance data from ISRO's MOSDAC (INSAT-3DR) and EUMETSAT (Meteosat-9).
2. **Backbone Adaptation:** Replace standard 3-channel optical backbones with a multi-spectral spatial-temporal vision transformer (e.g. Swin Transformer) trained on synchronized multi-band infrared feeds.
3. **Continuous Numerical Loss:** Train auxiliary regression heads directly on continuous maximum sustained wind speed (knots) and central pressure (hPa) using Huber loss, rather than discrete categorical cross-entropy alone.
