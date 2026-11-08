# V6 scientific pipeline follow-up

## Confirmed implementation gaps

The training pipeline exported only loss, accuracy, sample count and a confusion matrix. It did not compute the per-class precision/recall, macro F1, calibration diagnostics or abstention performance requested by V6-011. Split checks compared file hashes and event IDs, so a differently encoded image, or an image changed by one RGB level, could enter another split under a different event ID.

The new regressions failed before the fixes: one missing metrics field and two image-content leakage cases reached backbone construction. See `v6-evaluation-before.xml`. These tests use synthetic fixtures to verify code behavior, not to claim cyclone model skill.

## Implemented behavior

`backend/app/services/evaluation.py` accumulates confusion counts, per-class support/predicted count/precision/recall/F1, macro F1, equal-width-bin expected calibration error, multiclass Brier score and negative log likelihood. Unsupported-class divisions use zero with explicit support counts. Empty or malformed evaluations are rejected. These are diagnostics of probabilities, not a fitted calibration or validation certificate.

Abstention coverage, accepted accuracy and selective risk use the existing serving heuristic (probability >= 0.60, normalized entropy <= 0.65, margin >= 0.15). Thresholds are fixed before evaluation; they are not selected on the test partition. If every sample is rejected, accepted accuracy and risk are unavailable, not invented as perfect. The test partition is evaluated only after validation-loss checkpoint selection.

`backend/app/services/image_leakage.py` checks decoded RGB content and near-identical 32x32 RGB thumbnails before model construction or weight download. Exact decoded copies are rejected across splits even when file metadata changes. A fixed per-channel mean absolute difference threshold of two 8-bit levels flags near-identical thumbnails for review. A candidate index avoids an NxN allocation; excessive candidate comparisons halt training. Same-split copies do not falsely constitute cross-split leakage.

This conservative automated screen can flag similar images for review and cannot prove the absence of arbitrary crops, rotations, spatial overlap or semantic duplication. Independent scene/time/geography review remains required. No image is silently removed or reassigned, and frozen storm splits are preserved.

The exported metrics explicitly report OOD evaluation as NOT_EVALUATED when no separate reviewed benchmark is supplied. Class-zero accuracy is not treated as an independent OOD experiment. All generated training metadata still has scientifically_validated=false.

## Remaining scientific gate

The NOAA inventory still has zero training-eligible records. No production model was trained, no real evaluation result was invented, and no experimental model was promoted. Reviewed imagery-label joins, independent negatives/OOD imagery, complete class coverage, calibration and independent review remain necessary. This follow-up completes additional evaluation machinery and admission safeguards, not V6-011 scientific validation.

## Hosted CI finding

The first V6 push at c24c03f04cd830be85178e6dc060fb97afb0cf97 passed the hosted backend and frontend jobs, including audits, real infrastructure and browser tests. Its secret scan flagged the SHA-256 of v6-body-auth-before.xml in ENGINEERING_PROGRESS_V6.json as a generic API key. Recomputing that file's hash confirmed the exact value. The exception matches only that rule, file and exact evidence line; no directory, arbitrary hash or commit is excluded. The corrected full-history scan passes locally.

The follow-up implementation is kept local at the user's request after Git rejected a later push. Hosted verification of the follow-up is therefore pending. Render troubleshooting remains skipped as previously requested.

## Authentic frame review continuation

The downloaded 98-frame sample now has checksum-verified binary decoding, calibrated IR scale/offset application with fill masking, and 98 exact nominal storm/time joins to the frozen manifest. Actual acquisition timestamps differ from nominal time; original metadata and center differences are retained. Pixel decoding is not scientific model calibration. No frame is promoted, and no wind averaging convention is guessed. See [continuation report](V6_CONTINUATION_REVIEW.md) and `backend/data/manifests/hursat_sample_review.json`.
