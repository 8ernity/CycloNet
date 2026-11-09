# Local chat reliability review

Starting revision: 767c105c9a87b833c308004d22bbbb32311c6fcc on main. All changes in this review remain uncommitted. No commit or push was performed.

## Confirmed local defects

1. New Conversation cleared visible messages but left the previous request running and the Send control disabled. The old reply could appear in the new conversation. A request controller now owns each response; clearing/unmounting cancels it, and late success/error/finally callbacks cannot change another conversation.
2. Unchecked response JSON reached React string/array rendering. Objects instead of response text or source arrays could crash the panel. The client now validates text, metadata and source lists, and displays a recoverable unavailable message on malformed data.
3. Response JSON was parsed without a byte bound. The reader now rejects more than 64 KiB, including chunked data without Content-Length, before parsing. Text is capped at 12,000 characters; at most eight source labels of 300 characters are accepted. Invalid UTF-8 and malformed JSON fail closed.

## Evidence

Four browser tests failed against the prior production build: immediate resend after a new conversation, object response text, invalid sources, and excessive response text. See v6-chat-reliability-before.xml. The same expectations are used after the fix.

All 19 frontend unit tests pass, including five new tests for field validation, split UTF-8, invalid JSON, and cancellation of an oversized response stream. TypeScript passes. ESLint reports zero errors and 172 existing warnings. Production build passes. All 16 browser tests pass, including the four new regressions, with zero failures or skips. Evidence: v6-chat-reliability-browser-results.xml, v6-chat-reliability-unit.txt, v6-chat-reliability-build.txt and v6-chat-reliability-eslint.json. Exact evidence checksums are recorded in ENGINEERING_PROGRESS_V6.json under local_uncommitted_review.

Files: frontend/src/components/ChatbotWidget.tsx, frontend/src/lib/chatResponse.ts, frontend/tests/chat-response.test.mjs, frontend/tests/browser/chat-reliability.spec.ts.

These fixes required no new cloud access, production credentials, independent scientific dataset or infrastructure deployment. Prior backend/scientific results are unchanged; they were not re-run or re-certified by this frontend-only review. This finding also means the earlier release status was a snapshot of the tests and audit performed, not proof that every local defect had been discovered.
