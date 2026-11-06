# CycloNet Remaining Issues & Operational Limitations

This document provides a transparent, unvarnished accounting of known architectural, scientific, and infrastructure limitations in CycloNet. These limitations prevent the platform from acting as an authorized primary forecasting system without secondary validation.

---

## 1. Scientific & Meteorological Limitations

### 1.1 ML Satellite Classification Training Scale
- **Current State:** The repository includes a lightweight demonstration subset and pre-trained weights for ResNet-50.
- **Limitation:** The model has not been trained on millions of multi-spectral geostationary satellite frames across all global basins (Atlantic, East Pacific, West Pacific, North Indian Ocean, South Indian Ocean, Australian).
- **Risk:** High epistemic uncertainty when evaluating unusual storm morphologies (annular hurricanes, subtropical transitions, shearing environments).
- **Recommended Next Action:** Integrate an automated training pipeline pulling directly from NOAA NCEI's GridSat-B1 or NASA's MERRA-2 archives with stratified 5-fold cross-validation partitioned strictly by year and basin.

### 1.2 Storm Surge Hydrodynamic Modeling
- **Current State:** Coastal surge calculations use modified Jelesnianski and parametric wind-pressure formulations.
- **Limitation:** Parametric equations do not solve the full 2D Shallow Water Equations (SWE) or account for local sub-grid bathymetry, tidal phase coupling, astronomical tides, or barrier reef friction dissipation.
- **Risk:** In complex estuaries (e.g., Sundarbans, Hooghly River, Chesapeake Bay), actual surge levels may deviate significantly from parametric approximations.
- **Recommended Next Action:** Incorporate or couple with NOAA SLOSH or open-source ADCIRC simulation outputs via pre-computed surge response lookups.

### 1.3 Wind Averaging Standardization
- **Current State:** Ingestion feeds normalize reporting units to knots and km/h.
- **Limitation:** IMD reports 3-minute sustained winds, JTWC reports 1-minute sustained winds, and RSMC Tokyo/WMO reports 10-minute sustained winds. Conversion factors (e.g., 1-min to 10-min: ~0.88; 1-min to 3-min: ~0.93) are empirical and can introduce ±5-10% variance.
- **Recommended Next Action:** Expose native reporting conventions alongside normalized values in all API schemas and data views.

---

## 2. Infrastructure & Distributed System Limitations

### 2.1 Multi-Region High Availability
- **Current State:** Deployment uses single-region (Oregon) Render web services with managed Redis and PostgreSQL.
- **Limitation:** If the cloud region experiences an outage, failover to an alternative region is manual.
- **Recommended Next Action:** For operational mission-critical readiness, configure multi-region active-passive replicas with automated Route53 / Cloudflare DNS health check failover.

### 2.2 Cold Start Latency for PyTorch Model
- **Current State:** On free/starter server instances, PyTorch CPU initialization on container cold start takes 3-5 seconds.
- **Mitigation Implemented:** Added `/ready` readiness probe so traffic is not routed until models and database connections are loaded.
- **Recommended Next Action:** Keep instances warm with dedicated compute tiers and consider ONNX Runtime export for reduced memory footprint and faster CPU inference.

---

## 3. Regulatory & Statutory Authority Limitations

### 3.1 Non-Statutory Mandate
- **Current State:** CycloNet is designed and maintained as an academic and technological decision-support research platform.
- **Limitation:** CycloNet does not hold statutory legal authority under the National Disaster Management Authority (NDMA), IMD, or WMO to issue binding evacuation directives or emergency civil defense warnings.
- **Policy:** Automated Common Alerting Protocol (CAP) output must remain flagged with `<status>Exercise</status>` or `<status>Draft</status>`. Real civilian emergency communications must only be dispatched through authorized governmental channels.
