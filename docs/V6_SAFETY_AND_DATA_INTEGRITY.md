# V6 safety and data integrity

Reviewed 8 November 2026. The issue-by-issue root causes, changed files and executable evidence are in [ENGINEERING_PROGRESS_V6.json](ENGINEERING_PROGRESS_V6.json).

## Operational observations and scenarios

Shelter occupancy, available places, medical beds, road access, generator readiness and destination authorization are nullable observations. Each requires a source, verification time, expiration, verification state and authorized provenance. Missing, expired and simulated values cannot authorize a destination. The UI has no connected authorized infrastructure observation feed and therefore starts unavailable. Static asset names, coordinates, capacities and elevations are illustrative and hidden until scenario opt-in; they are not a field survey.

Road observations default to UNKNOWN and expire. Scenario exposure cannot assert an actual closure, an open alternative, a safe evacuation corridor, or a utility switching instruction. Insurance pools and calculations are hypothetical and non-contractual. No verified funding or payout delivery is claimed.

Forecast labels use the explicit backend provenance enum: LIVE_OBSERVATION, OFFICIAL_FORECAST, HISTORICAL_ARCHIVE, EXPERIMENTAL_FORECAST, DEMO_SIMULATION or UNKNOWN. IDs containing hyphens do not determine provenance. Future experimental points are not observations. Arbitrary confidence cones, fixed accuracy, synthetic gusts and unsupported steering/landfall or stable-intensity assertions were removed. Missing tracks render unavailable. No official forecast adapter or independently measured CycloNet forecast skill is claimed.

IMD movement speed preserves raw value and source unit; recognized knots convert by 1.852 to km/h. Missing or ambiguous units remain unavailable. Multi-system, multi-position, undated or stale unsupported pages cannot establish a current source fix. The current conservative IMD adapter supports only one explicitly dated advisory; broader source-format coverage remains a data-availability limitation. Wind averaging metadata is preserved rather than inferred as interchangeable across agencies.

Backend ingestion state controls AI source summaries. Missing UI selection cannot establish calm. Observation-mode briefings resolve server-side identities; user weather values only enter explicit scenario mode. Missing wind stays missing. General vision-generated meteorological estimates are disabled pending validation.

## Scientific limitations

The authentic NOAA inventory contains 12,275 observations from 363 storms, with frozen storm-disjoint partitions (260 training, 39 validation, 64 test storms). The prior HURSAT sample integrity record covers 98 raw NetCDF frames. This is retrieval/provenance evidence, not a complete image training set. Training-eligible records remain zero: reviewed image joins, spatial/temporal checks, preprocessing, complete independent non-cyclone negatives and independent evaluation are missing. The CLI halts with BLOCKED_EXTERNAL_DATASET. A shared exception type now makes that halt clean when invoked as a script. No trained or scientifically validated checkpoint, accuracy, calibration or OOD result was fabricated.

Sentinel-1 observed flood mapping remains disabled. Earth Engine access alone would not validate preprocessing, scenes, masks or flood extent. Simplified surge and flood products are scenarios; bathymetry and coastal slopes are assumed. Runoff outputs explicitly identify assumed terrain and illustrative asset locations, do not claim actual impacted roads, and leave actual choke-point status unverified. No measured DEM raster, calibrated inundation interval or independently verified water-level skill is claimed.

## Communications and presentation

CAP payloads retain Exercise status. Dispatch responses contain drafts, empty delivery receipts, null hardware counts and null measured delivery latency. Operator events cannot reach the public telemetry channel. No SACHET, siren, VHF, cell broadcast or government authorization is implied. Future operational delivery requires a separately reviewed integration and human/institutional authorization.

Landing-page fabricated benchmarks, testimonials, funding, certification and integration claims were replaced with actual capability limits. The README now describes implemented behavior and reproducible setup, superseding older promotional descriptions. Historical audit documents describe their own revisions and are not current release certifications.

Software checks cannot establish OPERATIONAL_DISASTER_SYSTEM_READY. Follow official agency advisories for actual emergencies.
