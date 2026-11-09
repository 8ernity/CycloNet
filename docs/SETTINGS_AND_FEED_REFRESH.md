# Settings and live refresh correction

Verified locally on 2026-11-09. Changes remain uncommitted on `main`; no push or deployment performed.

## Cause and behavior

The old **Sync Live Feeds** button posted to `/api/ingest/sync`, which requires an administrator key or a cryptographically verified administrator JWT. A normal sign-in does not grant that permission. The UI incorrectly described all signed-in accounts as verified operators.

The dashboard now offers **Refresh live data**. It reads ingestion status and available observations, without starting a privileged ingestion job. Backend authorization is unchanged. Refreshing cannot restore an unavailable upstream source or force a new agency scrape.

## Settings corrections

- Responsive cards, aligned choices, compact spacing, and a visible page heading. Navigation resets the scroll position so Settings does not inherit a scrolled view.
- Keyboard-accessible category choices and explicit light/dark theme choices, with preferences persisted locally.
- Removed the false automatic 14% wind conversion claim. Display preferences preserve reported wind measurements.
- Removed misleading push-delivery and siren toggles. The notification control explicitly tests only local browser display and handles denied permission.
- Custom backend addresses are validated before saving or testing. Non-HTTP schemes, embedded credentials, queries, and fragments are rejected. Health checks omit credentials and have an eight-second timeout.
- Header identifies a selected storm record without calling it active. Account labels no longer imply an administrator/operator role.

## Verification

- Initial regression suite: four expected failures against the old build (`settings-sync-before.xml`).
- Unit tests: 21 passed (`settings-sync-unit.txt`).
- TypeScript check and production build: passed (`settings-sync-build.txt`).
- ESLint: zero errors, 168 warnings across the existing frontend (`settings-sync-eslint.json`).
- Full Chrome browser suite: 23 passed, zero failed or skipped (`settings-sync-browser-results.xml`, `settings-sync-browser.txt`).
- Browser cases cover read-only refresh without an ingestion POST, saved themes and category preferences, custom URL persistence/rejection, denied notification permission, navigation from a scrolled dashboard, and a 390-pixel viewport without horizontal overflow.
- Desktop dark/light and mobile screenshots were inspected locally in `.verification/settings-after-*.png`.

Browser API fixtures test UI behavior; these checks do not certify live agency feeds, actual push delivery, deployed infrastructure, or production readiness. Prior uncommitted chat-reliability changes were preserved and their browser regressions passed in the full suite.
