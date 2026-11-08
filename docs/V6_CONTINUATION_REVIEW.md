# V6 continuation: resource, safety and authentic-data review

Work remains local at the user's request. Continuation starting revision: c5643f08d3cd4a2ad056313531b663f5a55fe3d2. Implementation commit: 856b5f22b3a813074901fb5612ff713707ea78b1. No remote push, Render deployment or operational activation was performed.

## Confirmed defects and corrections

- Redis inference leases can expire while a native call continues. Added hard process limits (eight production calls, two per identity) held until the actual call ends, with idempotent release and admission-failure cleanup. Redis quotas and distributed leases remain in force. These process bounds are not a guarantee of eight outstanding calls across all workers after Redis state loss; fleet behavior still needs staging verification.
- Per-request body caps alone permitted unbounded aggregate buffering. At most four multipart uploads and 32 other modifying request bodies enter each process. Excess requests receive 429 before body reads. Permits are released on completion, disconnect, rejection or exception. Existing byte/depth/time limits remain.
- IMD bulletin headings were interpreted as storm names, and a direction regex accepted AT, NOR and arbitrary letter prefixes. Strip the document heading from name extraction and accept complete compass terms only. The adapter still deliberately rejects ambiguous or unsupported advisory layouts; this is not evidence of complete live IMD coverage.
- Chat generated-text filtering could return unsupported instructions such as returning home or sailing. Provider output now selects one strict educational-topic enum; it cannot supply displayed prose. Extra fields, malformed replies and unsupported topics produce backend uncertainty. Fixed explanations do not contain generated orders, invented measurements, unsupported numerical scale equivalences or echoed user instructions.
- Fresh unreconciled records were labeled stale; failed feeds without records were labeled only uncertain. Backend summaries now distinguish those conditions.
- The opened chat advertised nonexistent model/version and vision capabilities. Its cards and labels now describe education and source status.
- Offline classification presets fabricated confidence, wind, Dvorak estimates and evacuation instructions, including in downloaded JSON. Removed all result presets. Example images use the same bounded classifier request path as uploads; unavailable inference returns null measurements and no operational recommendation. General vision analysis stays disabled. Requests are cancelled/replaced when a new image is selected or cleared. Export waits for the result. Removed the archive-save button that only displayed a false success message.
- Landing detail panels, footer and CTA still claimed observed satellite metrics, monitored roads, a funded payout policy, institutional users and security-standard compliance. Replaced those claims with actual availability and research limitations. Road scenario wording no longer claims safe rerouting or mandatory corridors. Removed unused translated strings that asserted active evacuation without observations.

## Authentic NOAA sample review

`backend/scripts/review_hursat_sample.py` reads the existing authentic NOAA archive, checks its acquisition checksum and every inventoried member checksum, validates units and identifiers, decodes IRWIN scale/offset while masking fill pixels, and joins exact storm ID plus nominal UTC time to the frozen manifest. It does not extract archive paths to disk. Original floating-point day values are retained; only less-than-one-millisecond representation noise is removed before joining.

Actual result: 98 frames, 49 nominal times, all 98 exact nominal joins. All belong to the existing train storm; no split was reassigned. Acquisition starts are 1,800 seconds before nominal time for one satellite or 720 seconds after it for the other. Embedded tracks are v03r09; the manifest is v04r01. Center separation ranges from zero to 22.486707 km. Valid IR pixels range from 71,476 to 90,601 of 90,601. The 98 frame labels include 58 supported-intensity records, 26 below the supported class range and 14 missing agency intensity records. These counts include two satellites per nominal time; they are not independent storm counts.

The embedded HURSAT wind averaging convention is not established, so no wind conversion or label substitution is performed. The acquisition offsets, missing pixels, version differences and label issues remain explicit review reasons. Zero frames are training eligible. No model was trained or promoted and no accuracy result is claimed.

Reproduce from the repository root with the optional pinned `backend/requirements-data-review.txt` environment:

```text
python backend/scripts/review_hursat_sample.py
```

Report: `backend/data/manifests/hursat_sample_review.json`. The raw downloaded archive is intentionally outside Git. Pure-logic tests cover exact joins, no nearest-time substitution, duplicate-label rejection, units of distance, sub-millisecond time normalization and checksum failure before decoding. The actual 98-frame run provides binary-reader evidence beyond the synthetic tests. Optional review dependencies have a separate vulnerability audit; production dependencies are unchanged.

## Regression evidence

- Resource admission: three captured failures before correction; focused after report plus full backend suite.
- IMD parsing: four failures / eight passes before, 12 passes after.
- Generated guidance: four actual behavior failures before, 15 focused tests after (includes existing AI and HURSAT checks). An initial mock incorrectly entered the same HTTP client twice; it was corrected before the retained baseline evidence.
- Basin state: two failures / one pass before; all three pass in the complete suite.
- Opened assistant, classification fallback and landing detail claims each have a captured failing browser report. The sample selector test was corrected to click the card containing the image, because an overlay intercepts image clicks; expected safety behavior was not weakened. The extended road test initially used an outdated tab label; it now selects the actual Road scenario exposure control.
- Final backend: 253 passed, no failures or skips, including real PostgreSQL/Redis checks. Frontend and final secret-scan results are recorded in V6_TEST_RESULTS.md after completion.

Independent scientific review, negative/OOD imagery, Earth Engine access and validated products, authorized operational feeds, staging/load/recovery verification and institutional authority remain external gates. Software tests do not establish disaster-response readiness.
