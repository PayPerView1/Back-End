# Main Backend Sprint 1–5 Review

## Scope and evidence

This review covers the existing Express/Mongoose backend against the checked-in Sprint 1–5 requirements and API contracts, plus the PayPerView SRS. It does not treat an endpoint's existence as proof that its full workflow is operational. Code changes are limited to the backend; the frontend and FastAPI service were not modified.

Sprints 6–10 do not have detailed sprint acceptance criteria or endpoint contracts in the checked-in repositories. Their implementation is therefore described separately in `BACKEND_SPRINT_IMPLEMENTATION.md` and is based only on the user-provided brief and explicit SRS requirements.

## Sprint outcomes

| Sprint | Review result | Corrections in this pass | Verification status |
|---|---|---|---|
| 1 — Authentication/profile | Reviewed registration, email verification, login, password changes/reset, logout, JWT middleware, role assignment, and profile routes against the Sprint 1 requirements. | JWT token-version revocation is checked by auth middleware; sensitive authentication endpoints have request validation and rate limits. Password reset/change revokes previously issued tokens. | Auth unit/integration test cases were added. Database-backed execution is blocked by missing `MONGO_URI_TEST`; do not read this as an end-to-end pass. |
| 2 — Campaign management | Reviewed campaign/draft paths, campaign ownership, categories, campaign lifecycle, and existing AI review contract usage. | Confirmed a route-order bug: generic `/campaigns/:campaignId` middleware intercepted public category URLs and returned 401. Mounted category endpoints before generic campaign routers and retained `/categories` aliases. | Public category endpoint regressions pass in the focused run. Other database-backed campaign tests are blocked by missing `MONGO_URI_TEST`. |
| 3 — Advertiser wallet/budgets | Reviewed funding, webhook parsing, transaction history, refunds, campaign budget operations, and admin review. | Preserved raw-body parsing before JSON middleware for PayPal and Moyasar webhooks and retained existing advertiser ledger/provider architecture. | Provider sandbox and transaction integration checks are not available in this environment. No live payment-provider result is claimed. |
| 4 — Discovery/applications/moderation | Reviewed discovery, application eligibility/lifecycle, campaign reporting, moderation, and notification ownership/read behavior against Sprint 4 materials. | Existing role and ownership boundaries were preserved; no unrelated route redesign was made. | Database-backed discovery/application/moderation tests are blocked by missing `MONGO_URI_TEST`. |
| 5 — Materials/submissions | Reviewed materials access and redemption, download logs, drafts, link verification, submission lifecycle, AI review, advertiser/admin review, and background processing. | Fixed the submission-limit race by rechecking and updating the relevant records transactionally. Added explicit request-edits state and resubmission behavior, and made advertiser review/campaign approval counters transactional. | Submission, material-access, and transaction tests are present but could not execute without `MONGO_URI_TEST`. The provider behavior remains explicitly unavailable where the platform API returns no stats. |

## Verified corrections

- Public campaign category requests previously reached an authenticated parameterized campaign route first. The route-order fix is covered by `src/tests/campaignCategory.test.js` and passed.
- Token revocation uses a version stored with the user and included in JWT validation; logout and password changes invalidate older tokens. Relevant tests are in `src/tests/authSecurity.test.js` and `src/tests/authMiddleware.test.js`, but those DB-backed suites were not runnable here.
- Authentication request validation and rate limiting were added without changing the frontend contract; existing login/register route shapes remain in place.
- Password change validates `confirmPassword` against `newPassword`, and the endpoint continues to require the current password and authenticated JWT.
- Submission review has distinct advertiser states for approve, reject, and requested edits. Requesting edits requires a reason, frees the old link for resubmission, and remains distinguishable from final rejection.
- Submission capacity and campaign review counters are guarded by MongoDB transactions to avoid concurrent oversubscription or duplicate increments.
- Social metadata remains source-backed. The backend does not infer TikTok/Instagram views or viewer geography when those APIs do not return them.
- View accounting uses a persisted high-water mark so a provider counter drop and recovery cannot bill the same views twice. Withdrawal create/process responses now return populated payment-method details. Chat input validation matches the FastAPI 4,000-character limit.
- Final documentation review found and removed a duplicate `/auth/login` key that made OpenAPI YAML invalid. OpenAPI response schemas and the chatbot Markdown contract now match the implemented auth, category, chat, and payout responses.
- The full test run exposed an invalid Joi conditional schema that prevented every test importing the app from loading. It was corrected and covered by `src/tests/creatorEarningsValidator.test.js`.

## Optional, deferred, and unverified items

- The SRS excludes advanced AI fraud detection, creator tiers, additional X/Snapchat support, and AI-powered recommendations from the MVP. They were not added.
- Some Sprint 2–5 integrations need provider credentials/sandboxes for live verification. No credentials or sandbox access were available, so implementation presence is not represented as successful external execution.
- The existing database integration suite requires a replica-set URI in `MONGO_URI_TEST`. It was absent; database/business workflows therefore remain unverified by execution even where their test cases were added.
- SRS items requiring unspecified external data, providers, or contracts are listed as dependencies rather than assumed defects. See the Sprint 6–10 report for the specific limitations.

## Test status

The final focused, database-independent set passed **9 suites / 24 tests**. The full backend suite ran **42 suites**: **16 passed, 26 failed**, with **84 tests passed and 344 reported failed at setup** because `MONGO_URI_TEST` is not configured. Database-backed suites stop at setup, so those code paths remain unverified. JavaScript syntax and OpenAPI checks passed after the documentation correction. See `BACKEND_SPRINT_IMPLEMENTATION.md` for details.
