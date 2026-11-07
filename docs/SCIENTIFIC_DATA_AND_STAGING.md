# Scientific data and staging verification — 7 November 2026

The proposed service names are configuration targets, not verified existing resources.
No hosted service was created, deployed, or charged by this remediation.

## Authentic NOAA inventory

`backend/data/manifests/cyclonet_ni_scientific_v1.csv` contains **12,275 observations
from 363 distinct NOAA IBTrACS storm IDs**, restricted to North Indian Ocean main
tracks in 1978–2015. The downloaded v04r01 source is 27,907,168 bytes, SHA-256
`137d896f68f8dd12d365ec646d77b6e32128770847ac8ef37e1d0f662ac34915`.
The provenance sidecar records the source URL, source hash, manifest hash, exclusions,
label policy, and exact counts. Raw downloads are intentionally excluded from git.

The fixed split hashes the storm ID with a versioned salt, independently of intensity,
record order, or model performance. All observations from a storm share one split:

| Partition | Storms | Observations |
|---|---:|---:|
| Train | 260 | 9,052 |
| Validation | 39 | 1,343 |
| Test | 64 | 1,880 |

The 70/15/15 hash thresholds describe the assignment rule; finite sample counts are
not forced to those ratios. Do not reshuffle based on test performance. Model training
preserves explicit manifest assignments and rejects missing classes or overlapping
event IDs/image checksums. The legacy JSON training path now assigns each event once
globally, fixing the earlier class-by-class partition bug for changing storm intensity.

Labels preserve **NEWDELHI three-minute wind in knots**, without conversion from
another agency's averaging period. Missing wind remains missing. Original agency
flags O/V may be eligible after image verification; interpolated I/P labels are excluded.
The current class map supports CS [34,48), SCS [48,64), VSCS [64,90), ESCS [90,120).
Below-34-kt storm records are **not** independent non-cyclone negatives; super cyclones
at or above 120 kt are outside this class map. Neither is silently relabeled.

All **38 HURSAT yearly indexes** for 1978–2015 were fetched. The checked-in catalog
contains authentic archive links for **246 exact matching storm IDs**, covering 9,494
manifest observations. The other 117 IDs remain unmatched; names or coordinates were
not used to invent matches. HURSAT v06 was generated using IBTrACS v03r09, so historical
identity changes and spatial/time alignment need review before training.

The authentic Ashobaa archive (`2015157N13069`) was downloaded: 22,650,481 bytes,
SHA-256 `6d3a774bec9ea8058f94d753d3a8240f930d9333eb0df13ddbfac0b9af60b958`.
Its 98 NetCDF frames were read directly from the archive without filesystem extraction;
member checksums are in `backend/data/manifests/hursat_sample_integrity.json`.
This proves retrieval/integrity only. The manifest's image paths refer to prepared
model inputs, which remain absent; it does not pretend raw NetCDF is a verified RGB image.

**Training eligibility remains zero.** Required work/data includes verified frame joins,
pixel preprocessing/QC, independent non-cyclone imagery, a reviewed complete class map,
and independent evaluation/calibration. The training CLI rejects this inventory before
constructing a model. No accuracy metrics or scientifically validated checkpoint were generated.

Reproduce from `backend/`:

```powershell
python scripts/acquire_scientific_sources.py
python -m app.services.scientific_manifest --source data/raw/ibtracs.NI.list.v04r01.csv --archive-catalog data/manifests/hursat_v06_archive_catalog.json
python train_classifier.py data/manifests/cyclonet_ni_scientific_v1.csv
```

The last command is expected to halt with `BLOCKED_EXTERNAL_DATASET`. NOAA updates the
IBTrACS file, so `--refresh-records` may produce a new source hash; review and version a
new manifest instead of silently replacing an evaluation dataset.

Sources: [NOAA IBTrACS](https://www.ncei.noaa.gov/products/international-best-track-archive),
[column definitions](https://www.ncei.noaa.gov/sites/default/files/2025-09/IBTrACS_v04r01_column_documentation.pdf),
[NOAA HURSAT](https://www.ncei.noaa.gov/products/hurricane-satellite-data),
[HURSAT v06 archive](https://www.ncei.noaa.gov/data/hurricane-satellite-hursat-b1/archive/v06/).

## Staging configuration

`render.staging.yaml` targets branch `staging`, region Oregon, and:

- `cyclonet-backend-staging` — production security policy, Alembic pre-deploy migration,
  hash-locked dependencies, `/health/ready`, proposed Earth Engine project ID.
- `cyclonet-frontend-staging` — Node/Next.js build and matching backend origin.
- `cyclonet-db-staging` — managed PostgreSQL candidate configuration.
- `cyclonet-redis-staging` — managed Redis candidate with no-eviction policy.

Automatic deployment is off. These are paid candidate plans, not an applied Blueprint
or an HA certification. `docs/v5-render-schema-results.json` records validation against
[Render's published schema](https://render.com/schema/render.yaml.json).
Schema validation does not establish resource availability, account access, or successful deployment.

Required secure configuration is a consistent Clerk test instance on frontend/backend:
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_ISSUER`,
`CLERK_JWKS_URL`, and the actual frontend URL in `CLERK_AUTHORIZED_PARTIES` and
`CORS_ORIGINS`. Verify actual Render-assigned hostnames before activation. Supply Gemini
credentials only if that optional feature is enabled. Do not put secrets in YAML or chat.

The GitHub workflow supports push, pull request, and manual dispatch. It explicitly
checks for the two Clerk test-instance repository secrets before frontend build/browser
checks. Hosted CI has now run on the published `staging` branch and draft PR #2.
The latest verified run, 42387677571 attempt 2 on staging commit
`84750d1c6a3208d633600127058f24096ccd4c61`, passes backend tests, Python audits,
secret scanning, frontend audit/lint/typecheck/unit checks, Clerk configuration,
production build and browser checks. The earlier missing Clerk secrets blocker is
resolved; this does not verify a deployed user's login or operator roles.
Render and GitHub are installed, but their authenticated read calls currently return
`MCP -32001 Unknown tool`. Public GitHub REST access independently confirmed the
successful run. No Render resource state or deployment has been verified. See
`v5-hosted-ci-results.json` for hosted evidence.

## Earth Engine

`GEE_PROJECT_ID=cyclonet-ee-staging-8ernity` is configured as the proposed target.
No Earth Engine credentials or SDK are present, and project creation/registration,
API enablement and IAM permissions have not been verified. See [Earth Engine access](https://developers.google.com/earth-engine/guides/access).
Authentication alone must not enable flood observations: a real Sentinel-1 processing
pipeline and independent reference evaluation are also required. The app continues to
return `SATELLITE_DATA_UNAVAILABLE`, `capability_status=DISABLED`, and an empty feature
collection; experimental simulation remains separate.

## Follow-up manifest validation

The loader now requires a literal JSON boolean `true` for readiness, NEWDELHI
three-minute winds, and supported storm classes 1–4. This NOAA-only CSV cannot supply
class-0 examples; reviewed independent negative imagery must come from a separately
constructed combined dataset. Five admission defects were reproduced and corrected;
all 18 related tests and all 137 Windows backend tests pass.
