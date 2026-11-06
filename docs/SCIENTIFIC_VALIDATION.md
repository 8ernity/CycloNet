# CycloNet Scientific Validation & Meteorological Methodologies

This document defines the physical principles, meteorological standards, mathematical formulations, and scientific limitations governing CycloNet's analytical engines.

---

## 1. Primary Meteorological Data Sources

CycloNet ingests and cross-references data from the following authoritative meteorological centers:

1. **RSMC New Delhi (India Meteorological Department - IMD):**
   - **Area of Responsibility:** North Indian Ocean (Bay of Bengal and Arabian Sea).
   - **Standard Wind Averaging Period:** 3-minute maximum sustained surface wind (MSW).
   - **Pressure Baseline:** Background peripheral pressure typically 1008–1012 hPa in tropical latitudes.
2. **Joint Typhoon Warning Center (JTWC):**
   - **Area of Responsibility:** Global tropical cyclones outside North Atlantic and East Pacific.
   - **Standard Wind Averaging Period:** 1-minute maximum sustained surface wind.
3. **NOAA National Centers for Environmental Information (NCEI) — IBTrACS v04:**
   - **Data Asset:** International Best Track Archive for Climate Stewardship.
   - **Usage:** Benchmark historical tracks, storm radii, and pressure records for model validation and comparative routing.

---

## 2. Wind Averaging Standard Harmonization

Because different meteorological agencies report maximum sustained wind (MSW) using different time averages, CycloNet applies standard WMO conversion ratios:

$$V_{\text{10-min}} \approx 0.88 \times V_{\text{1-min}}$$
$$V_{\text{3-min}} \approx 0.93 \times V_{\text{1-min}}$$

### Operational Rule
- When ingesting JTWC bulletins (1-min winds), CycloNet annotates the data quality schema with `wind_averaging_period: "1-min"`.
- When ingesting IMD bulletins (3-min winds), CycloNet annotates the data quality schema with `wind_averaging_period: "3-min"`.
- UI charts specify the wind averaging convention to prevent false comparisons across differing basin standards.

---

## 3. Deep Learning Satellite Intensity Estimation

CycloNet uses a customized **ResNet-50** convolutional neural network for automated satellite intensity feature extraction.

### 3.1 Dvorak Technique Grounding
The architecture is inspired by the **Dvorak Technique (Dvorak, 1984)**, which correlates cyclone intensity with:
1. Pattern type (Curved band, Shear, Eye pattern, Central Dense Overcast - CDO).
2. Temperature contrast between the cyclone eye and surrounding cloud tops (Enhanced Infrared / EIR).
3. Cloud system center symmetry and spiral banding tightness.

### 3.2 Uncertainty Quantification
To prevent overconfident predictions on anomalous or degraded satellite images, the inference engine calculates:
1. **Normalized Shannon Entropy:**
   $$H(p) = -\frac{1}{\log K} \sum_{i=1}^K p_i \log p_i$$
2. **Negative Log-Sum-Exp Energy Score:**
   $$E(x) = -T \cdot \log \sum_{i=1}^K e^{z_i / T}$$
3. **Maximum Softmax Probability (MSP):**
   $$\text{MSP} = \max_i p_i$$

Predictions where $H(p) > 0.65$ or $\text{MSP} < 0.60$ are classified as **HIGH UNCERTAINTY** and flagged with a warning requiring expert meteorologist review.

---

## 4. Storm Surge & Coastal Inundation Physics

### 4.1 Parametric Wind-Pressure Field
CycloNet calculates radial wind profiles using the **Holland (1980)** parametric vortex equation:

$$V(r) = \left[ \frac{B}{\rho_a} \left(\frac{R_{\text{max}}}{r}\right)^B (P_n - P_c) \exp\left(-\left(\frac{R_{\text{max}}}{r}\right)^B\right) + \left(\frac{r f}{2}\right)^2 \right]^{1/2} - \frac{r f}{2}$$

Where:
- $P_c$: Central atmospheric pressure (hPa)
- $P_n$: Ambient peripheral pressure (typically 1010 hPa)
- $R_{\text{max}}$: Radius of maximum winds (km)
- $B$: Holland scaling parameter (typically $1.0 \le B \le 2.5$)
- $\rho_a$: Ambient air density ($\approx 1.15 \text{ kg/m}^3$)
- $f$: Coriolis parameter ($2 \Omega \sin \phi$)

### 4.2 Jelesnianski Inverted Barometer Effect
The static sea surface rise due to atmospheric pressure deficit is estimated using the **Inverted Barometer Effect**:

$$\Delta \eta_{\text{baro}} = \frac{P_n - P_c}{\rho_w g} \approx 0.01 \text{ m/hPa} \times (P_n - P_c)$$

For a major cyclone with $P_c = 920 \text{ hPa}$ ($P_n - P_c = 90 \text{ hPa}$), the barometric rise alone accounts for $\approx 0.90 \text{ m}$ of surge.

### 4.3 Hydrodynamic Modeling Assumptions & Limitations
- **Current Formulation:** CycloNet applies parameterized 1D radial equations with coastal slope modifiers.
- **Assumptions:** Continental shelf slope is parameterized; sub-grid coastal river estuaries, mangrove wave attenuation coefficients, and astronomical tidal phase interactions are approximated.
- **Precautionary Notice:** Parametric surge estimates must not be used as the sole engineering basis for seawall construction or real-time barrier opening/closing. Official hydrodynamic warnings must be sourced from the regional oceanographic agency (e.g., INCOIS, NOAA NHC).
