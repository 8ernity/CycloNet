# V7 scientific validation

Scientific status remains **unvalidated**. No production model was trained or promoted, and no satellite flood validation was fabricated.

## FIX-008 / FIX-009: dataset and model

The existing authentic NOAA inventory and frozen storm-disjoint partitions remain intact. The HURSAT review contains 98 frames, 98 nominal-time joins and **zero training-eligible records**. Source archive checksum, per-frame checksums, acquisition times, nominal-time differences, older embedded track version and missing-pixel review remain recorded in `backend/data/manifests/hursat_sample_review.json`.

`train_classifier.py data/manifests/cyclonet_ni_scientific_v1.csv` exits 1 with `BLOCKED_EXTERNAL_DATASET`: [gate evidence](v7-training-gate.txt). This is a required refusal, not a successful training run. Existing leakage, split, evaluation, calibration, abstention and OOD admission tests remain part of the backend gate.

Required external inputs:

1. Independent scientific approval resolving actual-acquisition versus nominal timestamps, embedded/current best-track differences, wind averaging conventions, uncertain intensity labels and missing infrared pixels.
2. Sufficient approved authentic images for each required class across independent storms and periods, with reproducible preprocessing and source licenses/provenance.
3. Independently justified non-cyclone negatives and a separate OOD corpus, including event/time/geography separation and duplicate/near-duplicate review.
4. Predeclared acceptance thresholds and baselines, followed by calibration on validation data and a single untouched final-test evaluation; independent reviewers must approve evidence before enabling `scientifically_validated`.

Model output metrics cannot be populated from software unit tests. No real confusion matrix, scientific F1, calibration score or OOD skill is claimed.

## FIX-010: satellite flood mapping

No authorized Earth Engine project or independent reference flood dataset was verified. The existing observation interface correctly returns `SATELLITE_DATA_UNAVAILABLE`, empty measured features and scientifically-unvalidated status. Scenario polygons remain separate. The staging Blueprint no longer supplies an unconfirmed project name as if it established access.

Needed: authorized project/service account through a secret store; suitable matched Sentinel-1 scenes with orbit/polarization/date/coverage metadata; reproducible preprocessing including terrain, radar shadow and permanent water handling; independent flood masks and spatial accuracy review. Credentials alone do not establish a validated processing method.

References: [NOAA HURSAT](https://www.ncei.noaa.gov/data/hurricane-satellite-hursat-b1/archive/v06/), [IBTrACS](https://www.ncei.noaa.gov/products/international-best-track-archive), [Earth Engine access](https://developers.google.com/earth-engine/guides/access), [Sentinel-1 GRD](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD).

## Observations and catalog integrity

FIX-006 removes category-derived historical winds and preserves zero/null/malformed semantics; missing basin/category values no longer become invented source facts. V7 also preserves the explicitly registered BOB05-2026 demonstration label in catalog and trajectory responses, without guessing simulation from a year string. Curated track excerpts are described as requiring independent source verification, not as scientific validation evidence.

The export follow-up also removed fabricated PDF forecast coordinates, wind increments and landfall timing. PDF and JSON now preserve the supplied source category; display preferences cannot relabel it as an agency observation. Missing wind convention, source, basin and district conditions remain unavailable. Illustrative infrastructure and insurance data in JSON are explicitly marked as simulations. Real browser downloads and numeric/missing-value regression tests cover these boundaries; they do not validate the underlying scientific observations.

The read-only agency check returned IMD/JTWC degraded and GDACS failed XML parsing, with no records admitted: [actual results](v7-agency-readonly-check.json). It did not write cyclone state or establish basin-wide calm. Actual provider access and additional supported bulletin examples remain external operational evidence; no unsupported format is silently accepted.

The final frontend review removed additional dashboard landfall/coastal-approach defaults and derived gusts, corrected map source badges and source-relative waypoint time labels, and removed the fallback reports catalog. Coordinate displays preserve southern/western hemispheres. These changes protect presentation integrity; they do not establish scientific validity. See the reproduced failures and regressions in [local follow-up](V7_LOCAL_FOLLOWUP.md).
