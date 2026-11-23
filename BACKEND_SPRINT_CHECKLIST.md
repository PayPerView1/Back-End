# Main Backend Sprint Checklist

**Scope:** This checklist records the original backend-only implementation pass for Sprints 1–10. Later phases added FastAPI AI endpoints and frontend integrations; see the [final project QA report](../FINAL_QA_REPORT.md) and `docs/README.md` for the current integrated state.

## Specification sources and limits

- Sprints 1–5: checked-in sprint documents, task lists, and `Requirements/API_CONTRACT_SPRINT2.md` through `API_CONTRACT_SPRINT5.md`.
- Product requirements: `Requirements/Pay_Per_View_SRS_Formatted.md`.
- Chatbot: `Requirements/chatbot_backend_requirements.md` and `Requirements/API_Contract_for_Chatbot.md`.
- Detailed Sprint 6–10 documents and endpoint contracts are absent. The user-provided brief and SRS are the available sources; thresholds, providers, and unsupported data are recorded as dependencies instead of assumed.
- `[x]` means implementation or source review is complete. Database-backed execution is tracked separately because this checkout has no `MONGO_URI_TEST`.

## Sprint 1 — Authentication and profile

- [x] Reviewed registration, verification, login, reset/change, logout, OAuth, profile, and interests routes against the checked-in requirements.
- [x] Added token-version revocation, hardened JWT validation, request validation, and rate limits for sensitive authentication routes.
- [x] Preserved user-selected CLIPPER/BRAND roles and role middleware; added regression tests.
- [blocked] Database integration tests cannot execute until a replica-set `MONGO_URI_TEST` is configured.

## Sprint 2 — Campaign creation and management

- [x] Reviewed campaign/draft lifecycle, category paths, ownership, campaign review, and the checked-in API contract.
- [x] Mounted public category paths before generic authenticated `/campaigns/:campaignId` routes and kept the legacy aliases.
- [x] Reviewed campaign AI calls against the existing FastAPI client/contract; no mock AI result is presented as a successful live result.
- [blocked] Database-backed campaign regressions require `MONGO_URI_TEST`; live third-party checks require configured credentials.

## Sprint 3 — Advertiser wallet and campaign budgets

- [x] Reviewed existing advertiser wallet, funding/webhook, transaction, refund, and budget paths; raw-body webhook middleware remains before JSON parsing.
- [x] Existing ledger and idempotency boundaries were retained; unrelated payment-provider architecture was not replaced.
- [blocked] Provider sandbox and database transaction tests were not executable without test DB/provider configuration.

## Sprint 4 — Discovery, applications, moderation, and notifications

- [x] Reviewed existing discovery, application ownership/lifecycle, moderation, and notification code against the SRS and Sprint 4 contract.
- [x] Retained scoped role checks and existing route contracts; no frontend changes.
- [blocked] Database-backed integration and transaction tests require `MONGO_URI_TEST`.

## Sprint 5 — Materials and submissions

- [x] Reviewed material access, token redemption, download logs, drafts, verification, submit/update/resubmit/withdraw, advertiser/admin review, and jobs.
- [x] Fixed the submission-limit race with a transactional recheck and consistent campaign counters.
- [x] Added distinct request-edits state/resubmission handling and transactional advertiser decisions; retained old endpoints.
- [x] Verified provider behavior remains unavailable when TikTok/Instagram do not provide stats; AI submission review remains tied to the configured service contract.
- [blocked] Submission lifecycle and DB integration tests require `MONGO_URI_TEST`.

## Sprint 6 — Video and clip management

- [x] Reused the existing submission/review workflows and database relationships.
- [x] Added advertiser `REQUEST_EDITS`, bulk approve compatibility route, and atomic bulk approve/reject review route; rejection requires a reason.
- [x] Review decisions and campaign approved-video counters update transactionally; creator notifications are sent after commit.
- [dependency] Minimum quality/rating/follower filtering lacks a defined threshold and consistent rating/audience data source in the existing backend.
- [blocked] Service-level database transaction tests require `MONGO_URI_TEST`.

## Sprint 7 — Views, fraud monitoring, and geography

- [x] Added source-backed view snapshots and polling for approved submissions; the first successful count is a baseline, not billable views.
- [x] Added per-submission snapshots, campaign analytics, interactions, ledger-backed per-video earnings, and explicit source/geography availability.
- [x] Added out-of-target-country and configurable rapid-growth flags, admin review, budget-bounded accrual, and seven-day earnings hold.
- [x] Geography is stored only when returned by the platform API; unavailable provider metrics are not inferred.
- [dependency] Anomaly-rate thresholds are not specified; rapid-growth flagging is disabled unless `MAX_VERIFIED_VIEWS_PER_HOUR` is configured.
- [dependency] Unusual account activity and viewer-country data require platform/account-linking sources not present for every provider.
- [blocked] Snapshot, aggregation, and transaction tests require `MONGO_URI_TEST`.

## Sprint 8 — Creator earnings and withdrawals

- [x] Added integer-cent earnings/wallet ledgers and separate pending, available, reserved, and withdrawn balances.
- [x] Added encrypted payment methods, creator-owned history, minimum withdrawal validation, transactional reservation, admin lifecycle, and notifications.
- [x] Failed payouts release ledger allocations and reserved funds transactionally; completion requires an external payment reference.
- [dependency] No payout provider contract or disbursement integration is present; processing is explicitly manual.
- [blocked] Wallet, payment-method, and withdrawal transaction tests require `MONGO_URI_TEST` and payment encryption keys.

## Sprint 9 — AI insights and chatbot integration

- [x] Hardened the existing Express chatbot proxy: owner-scoped threads, validated upstream responses, normalized errors, and no retries for mutating AI requests.
- [x] Added user feedback on owned assistant messages and retained existing thread/message APIs.
- [x] Later AI-service and integration phases added campaign, budget, recommendation, report, content-review, video, view/earnings, withdrawal, and language intelligence routes; the backend exposes owner/role-scoped proxies where supported.
- [dependency] Live Main Backend-to-AI calls require the same configured `AI_SERVICE_API_KEY` in both deployments. It is absent from the local configuration audited on 2026-11-12, so live private-route integration is blocked.
- [blocked] Chat persistence/route integration tests require `MONGO_URI_TEST`.

## Sprint 10 — Analytics and platform intelligence

- [x] Added advertiser-owned campaign analytics based on stored platform snapshots, including completed/archived campaign data when snapshots exist.
- [x] Added indexes and forward-only versioned migrations; `npm run migrate` applies pending migrations explicitly.
- [x] Later AI-service phases added Arabic/English detection and translation APIs, actual-pledge acceptance analytics, and successful archived-campaign pattern analysis; the existing app exposes the corresponding backend APIs where supported.
- [dependency] Backup/retention telemetry and storage-capacity/error feeds are still absent, so backup anomaly detection and storage issue prediction remain unimplemented.
- [dependency] No suitable existing frontend translation input workflow was found; the APIs are available, but no new interface was added. Analytics export remains outside the current implemented contract.
- [blocked] Migration and analytics integration tests require `MONGO_URI_TEST`.

## Cross-sprint release checks

- [x] Added OpenAPI coverage for changed/new endpoints; existing Sprint 1–5 contract documents remain the source for unchanged routes.
- [x] Added or updated tests for code paths and important fixes.
- [blocked] Full DB-backed test run: `MONGO_URI_TEST` is absent; see `BACKEND_SPRINT_IMPLEMENTATION.md` for exact run results.
- [x] During this backend-only pass, no frontend or AI-service source was modified; subsequent phases changed those services as recorded in the final project QA report.
- [x] Completed `BACKEND_SPRINT_REVIEW.md` and `BACKEND_SPRINT_IMPLEMENTATION.md`.
