# Main Backend Sprint 1–10 Implementation

## Scope and source limits

This document records the backend-only review and implementation pass. Later phases added FastAPI AI endpoints and frontend integrations; current integrated status and final test results are in the [final project QA report](../FINAL_QA_REPORT.md). Existing working routes were retained; the old public campaign category aliases and `/bulk-approve` endpoint remain available.

The final workspace status check found uncommitted changes in the sibling `PayPerView AI` repository; they were not touched in this backend pass. The sibling `PayPerView` frontend repository was clean at review time.

Sprints 1–5 were compared with the checked-in requirements and contracts. No detailed Sprint 6–10 acceptance documents or endpoint contracts exist in the available repositories. The later-sprint work below is limited to the explicit user brief and SRS. Missing provider contracts, thresholds, and data sources are recorded as dependencies rather than invented.

## Sprint 6 — Clip review

- Added advertiser `REQUEST_EDITS` as a distinct persisted/display state; the creator can resubmit after the requested edit, and the rejection note is required.
- Added all-or-nothing bulk approve/reject review with ownership, suspension, review-state, duplicate-ID, and rejection-reason checks. Campaign approval counts update in the same transaction as the submissions; notifications run after commit.
- Kept `POST /campaigns/:campaignId/submissions/bulk-approve` and added `POST /campaigns/:campaignId/submissions/bulk-review` for the SRS approve/reject workflow.
- Existing submission/review records and relationships are reused.
- Creator quality/rating/follower minimums remain a dependency: no product threshold or consistent source for creator ratings/audience metrics exists in the backend.

## Sprint 7 — Views and fraud review

- Added source-backed `SubmissionViewSnapshot` records with provider, timestamp, fetch status, view/interaction values, country views if supplied, deltas, eligibility, anomaly flags, and review status.
- Polls approved posts only. The first successful provider count is a baseline; only subsequent deltas can count toward earnings. Duplicate polling samples are constrained by a unique index.
- Added campaign analytics, per-submission snapshot history, admin review queue/decision, and source-availability flags. Per-video history includes ledger-backed gross, commission, net, due amount, and hold status when an earning record exists.
- Geographic values are accepted only when returned by a provider. TikTok oEmbed and the configured Instagram adapter do not currently supply view or viewer-country stats; their stats remain unavailable. Creator profile country is never used as viewer geography.
- Added out-of-target-country flags and an optional rapid-growth threshold. The SRS does not define a numeric rate, so rapid-growth flags are disabled unless `MAX_VERIFIED_VIEWS_PER_HOUR` is set. No unusual-account-activity data source is available.
- Fixed the CPM conversion to cents: `views × CPM / 10`. A standalone unit test verifies 1,000 views at a $5 CPM is $5, preventing budget over-consumption.
- Final review added persisted total and per-country high-water counters so provider count decreases followed by recovery do not create duplicate billable deltas.
- Verified eligible view accrual is bounded by campaign remaining budget and held for seven days. Fraud-flagged samples require admin confirmation before accruing eligible views.

## Sprint 8 — Creator ledger and withdrawals

- Added creator wallet and earning ledgers using integer cents; pending, available, reserved, paid, and withdrawn amounts are kept separately.
- Added creator payment-method add/list/deactivate, withdrawal request/history, and admin review/processing routes. Payment details use AES-256-GCM at rest; creator responses expose only type, label, and last four characters.
- Withdrawal requests reserve wallet funds and FIFO earning allocations in one transaction. Failure releases both exactly once; completion records an external payment reference and moves allocations to paid.
- Added the configured minimum (`MIN_CREATOR_WITHDRAWAL_USD`, default 10), admin lifecycle validation, notifications, and a job to release earnings after the hold period.
- **No payout gateway is configured or specified.** The endpoint supports an explicitly manual admin disbursement workflow; it does not claim to invoke PayPal, a bank, STC Pay, or Mada.
- Creator payment method encryption needs an environment key; key setup and rotation guidance is in `DATABASE_MIGRATIONS.md`. `CREATOR_COMMISSION_RATE` defaults to 0 until the business rate is configured and disclosed.

## Sprint 9 — AI and chatbot

- Hardened the existing Express chatbot integration: scoped thread ownership, request validation, upstream response validation, normalized AI errors, and safe retry rules (no automatic retries for mutating AI POST requests).
- Added feedback storage for assistant messages in the user's own thread.
- Matched Express chatbot input validation to the FastAPI 4,000-character limit and reconciled the chatbot API contract with current response fields and ownership errors.
- At the time of this backend-only pass, AI Service source did not expose the requested intelligence endpoints. Later phases added those FastAPI routes and owner/role-scoped backend integrations where supported. The remaining live integration blocker is the missing shared `AI_SERVICE_API_KEY` in local configuration; no generated fallback insight is returned.
- Existing campaign/submission AI paths remain connected only to their configured service contracts; absence or failure is not represented as a real approval or insight.

## Sprint 10 — Analytics and platform intelligence

- Added advertiser-owned campaign analytics from persisted provider snapshots, including totals, approved videos, participating creators, spend/budget, and geography availability.
- Added database indexes and versioned migrations. Migrations are explicit and are not run implicitly at server startup.
- Later phases added dynamic Arabic/English translation APIs, pledge acceptance analytics, successful archived-campaign pattern analysis, and AI campaign forecasts. Translation is not surfaced in a new UI because no suitable existing text-entry workflow was identified. Backup anomaly detection and storage forecasting remain blocked by missing backup/storage telemetry; report exports still require an explicit contract. No fabricated health or forecast data is provided.

## API endpoints added or changed

Base path: `/api/v1`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `PUT` | `/submissions/:id/review` | BRAND, own campaign | `APPROVE`, `REJECT`, or `REQUEST_EDITS`; rejection/edit request needs a note. |
| `POST` | `/campaigns/:campaignId/submissions/bulk-approve` | BRAND, own campaign | Compatibility endpoint; all-or-nothing bulk approval. |
| `POST` | `/campaigns/:campaignId/submissions/bulk-review` | BRAND, own campaign | All-or-nothing bulk approval or rejection. |
| `GET` | `/submissions/:id/views` | Owning CLIPPER or BRAND | Paginated provider snapshots and available earning detail. |
| `GET` | `/campaigns/:campaignId/analytics` | BRAND, own campaign | Campaign report with explicit metric availability. |
| `GET` | `/admin/view-snapshots/review` | ADMIN | Fraud/anomaly review queue. |
| `PATCH` | `/admin/view-snapshots/:id` | ADMIN | Confirm/dismiss a flagged snapshot. |
| `GET` | `/creator/earnings` | CLIPPER | Creator wallet summary. |
| `GET` | `/creator/earnings/transactions` | CLIPPER | Paginated earning ledger. |
| `GET`, `POST` | `/creator/payment-methods` | CLIPPER | List masked methods / add encrypted method. |
| `DELETE` | `/creator/payment-methods/:id` | CLIPPER, owner | Deactivate an unused method. |
| `GET`, `POST` | `/creator/withdrawals` | CLIPPER | Withdrawal history / reserve earnings. |
| `GET` | `/admin/withdrawals` | ADMIN | List withdrawal requests for manual payout. |
| `PATCH` | `/admin/withdrawals/:id` | ADMIN | Process, complete, or fail a request. |
| `PATCH` | `/chat/threads/:threadId/messages/:messageId/feedback` | JWT, own thread | Submit assistant-message feedback. |

`docs/openapi.yaml` documents the changed and added paths, auth scheme, roles, request/response shapes, and common errors. Unchanged Sprint 1–5 contracts remain in `Requirements/API_CONTRACT_SPRINT2.md` through `API_CONTRACT_SPRINT5.md`, `Requirements/SPRINT_1 Authentication and Profile.md`, and the chatbot contract.

## Database and operations

- Added `src/migrations/002-sprint6-10-financial-indexes.js` for the new collections' indexes and the submission poll index.
- Added a versioned migration runner (`npm run migrate`) and retained `npm run migrate:sprint4` as the Sprint 4 compatibility command. `DATABASE_MIGRATIONS.md` documents deployment order and encryption configuration.
- Added two cron jobs: provider-backed view sampling and due-earning release. Per-process overlap is suppressed; the unique sample index and conditional transaction writes make repeated runs idempotent.
- New collections: `SubmissionViewSnapshot`, `CreatorWallet`, `CreatorEarning`, `CreatorPaymentMethod`, and `WithdrawalRequest`.

## Tests and checks executed

The test counts below are the historical results from the backend-only implementation pass. The current final integration QA reran the applicable suites and is recorded in the [final project QA report](../FINAL_QA_REPORT.md).

- **Focused tests:** 9 suites passed, 24 tests passed (category routes, metadata normalization, finance and review validation, CPM/high-water accounting, encryption/rotation, AI-client behavior, password confirmation, and chatbot request limits).
- **Full backend suite:** 42 suites total; 16 passed and 26 failed, with 84 tests passed and 344 reported failed at setup. Failing database-backed suites abort because `MONGO_URI_TEST` is not configured. No usable replica-set test URI is available, so transaction, migration, and DB-backed endpoint paths remain unverified. The full suite was run; it is not reported as passing.
- **Static checks:** `node --check` passed for backend JavaScript under `src/` and `scripts/`; OpenAPI YAML parsed as 3.1 with 31 paths and no unresolved local references after correcting a duplicate `/auth/login` key; `git diff --check` passed (Git emitted only line-ending warnings).
- **Endpoint verification:** public campaign category routes were exercised through Supertest and pass. New database-backed endpoint tests exist, but could not execute without the test database.

## Remaining blockers and risks

1. Configure an isolated MongoDB replica-set `MONGO_URI_TEST`, then rerun `npm test`; do not use production data.
2. Configure platform API access that can return views and, if supported, viewer-country breakdowns. Until then, unsupported metrics are explicitly unavailable.
3. Define source-backed thresholds for rapid growth and unusual account activity; configure `MAX_VERIFIED_VIEWS_PER_HOUR` only after product/risk approval.
4. Supply payout provider/API contracts and credentials before replacing the manual admin disbursement step.
5. Supply AI routes and schemas for insight, forecast, and authorized campaign context before adding those calls.
6. Supply translation, backup/storage telemetry, consent/version, analytics export, and creator-quality data contracts before implementing those requirements.
7. Configure a stable `PAYMENT_DETAILS_FINGERPRINT_KEY` and encryption key ring in each deployed environment. Payment methods cannot be created if encryption is unavailable.

## Modified and added backend files

### Root and documentation

- Modified: `package.json`, `scripts/migrateSprint4.js`, `server.js`.
- Modified: `Requirements/API_Contract_for_Chatbot.md` to match the current chat message schema, ownership error behavior, feedback endpoint, and input limit.
- Added: `scripts/migrate.js`, `BACKEND_SPRINT_CHECKLIST.md`, `BACKEND_SPRINT_REVIEW.md`, `BACKEND_SPRINT_IMPLEMENTATION.md`, `DATABASE_MIGRATIONS.md`, `docs/openapi.yaml`.
- `Back-End/.gitignore` was already modified in the checkout and was preserved; it is not attributed to this implementation.

### App, auth, and shared code

- Modified: `src/app.js`, `src/config/passport.js`, `src/constants/discovery.constants.js`, `src/constants/submission.constants.js`, `src/controllers/authController.js`, `src/controllers/campaign/campaignCategory.controller.js`, `src/controllers/ai/chat.controller.js`, `src/middlewares/authMiddleware.js`, `src/models/user.js`, `src/models/ChatMessage.js`, `src/routes/authRoutes.js`, `src/routes/ai/chat.routes.js`, `src/services/ai/aiChatbotClient.service.js`, `src/services/notification/notification.templates.js`, `src/services/social/socialMetadata.service.js`, `src/utils/errors.js`, `src/utils/generateTokens.js`, `src/validators/submission/submissionReview.validator.js`, `src/utils/submission/submissionDto.utils.js`.
- Added: `src/middlewares/authRateLimiter.js`, `src/validators/auth.validator.js`, `src/validators/ai/chat.validator.js`, `src/services/ai/chatHistory.service.js`.

### Submissions, analytics, and finance

- Modified: `src/models/submission.js`, `src/controllers/submission/submissionReview.controller.js`, `src/routes/submission/submission.routes.js`, `src/services/submission/submission.service.js`, `src/services/submission/submissionNotifications.service.js`, `src/services/submission/submissionReview.service.js`.
- Added: `src/controllers/submission/submissionViews.controller.js`, `src/controllers/wallet/creatorEarnings.controller.js`, `src/jobs/creatorEarnings.job.js`, `src/jobs/submissionViews.job.js`, `src/migrations/001-sprint4-campaign-fields.js`, `src/migrations/002-sprint6-10-financial-indexes.js`, `src/models/CreatorEarning.js`, `src/models/CreatorPaymentMethod.js`, `src/models/CreatorWallet.js`, `src/models/SubmissionViewSnapshot.js`, `src/models/WithdrawalRequest.js`, `src/routes/admin/withdrawalAdmin.routes.js`, `src/routes/submission/submissionViews.routes.js`, `src/routes/wallet/creatorEarnings.routes.js`, `src/services/submission/submissionViews.service.js`, `src/services/wallet/creatorEarnings.service.js`, `src/services/wallet/creatorPaymentMethod.service.js`, `src/services/wallet/paymentDetailsCrypto.service.js`, `src/validators/submission/submissionViews.validator.js`, `src/validators/wallet/creatorEarnings.validator.js`.

### Tests

- Modified: `src/tests/helpers/db.js`, `src/tests/socialMetadata.test.js`, `src/tests/submissionLifecycle.test.js`, `src/tests/submissionReview.test.js`, `src/tests/submissionRoutes.test.js`.
- Added: `src/tests/aiChatbotClient.test.js`, `src/tests/authMiddleware.test.js`, `src/tests/authRateLimit.test.js`, `src/tests/authSecurity.test.js`, `src/tests/authValidator.test.js`, `src/tests/campaignCategory.test.js`, `src/tests/chatRoutes.test.js`, `src/tests/chatValidator.test.js`, `src/tests/creatorEarnings.test.js`, `src/tests/creatorEarningsValidator.test.js`, `src/tests/creatorFinanceRoutes.test.js`, `src/tests/migrationDefinition.test.js`, `src/tests/migrationRunner.test.js`, `src/tests/paymentDetailsCrypto.test.js`, `src/tests/submissionReviewValidator.test.js`, `src/tests/submissionViewAccounting.test.js`, `src/tests/submissionViews.test.js`, `src/tests/submissionViewsRoutes.test.js`.
