# Main Backend API documentation

When the Main Backend runs on its default local port, the documentation is available at:

- Swagger UI: `http://localhost:5000/docs`
- ReDoc: `http://localhost:5000/redoc`
- OpenAPI JSON: `http://localhost:5000/openapi.json`

For the internal Main Backend ↔ AI Service contract, local environment setup, and feature-by-feature verification status, see [AI_INTEGRATION_MAP.md](./AI_INTEGRATION_MAP.md), [AI_SERVICE_ENVIRONMENT.md](./AI_SERVICE_ENVIRONMENT.md), and [AI_INTEGRATION_STATUS.md](./AI_INTEGRATION_STATUS.md). The internal service credentials are intentionally not part of public OpenAPI documentation.

The document is served from `openapi.yaml`; the API itself uses `/api/v1` as its base path. Protected operations use the `BearerAuth` JWT scheme. Each operation also has an `x-roles` extension describing public, authenticated, CLIPPER, BRAND/BRAND_OWNER, or ADMIN access. The route middleware and resource-ownership check remain authoritative.

## Endpoint groups

Service, Authentication, Profile, Campaign taxonomy, Campaign discovery, Campaign management, AI Campaign Intelligence, Campaign budget, Applications, Materials and downloads, Content submissions, Analytics, Reports and moderation, Notifications, Wallet and payments, AI Budget Intelligence, Creator earnings, and AI Chat.

## AI engineering routes

- `POST /api/v1/campaigns/drafts/{draftId}/ai-assistance` returns advisory draft suggestions, policy checks, quality score, category, duplicate matches, and expiry status for the authenticated brand's own draft. It does not approve or mutate the draft.
- `POST /api/v1/campaigns/{campaignId}/ai-review` and `GET /api/v1/campaigns/{campaignId}/ai-review` retain the existing submit/check AI review lifecycle for an owned campaign.
- `GET /api/v1/campaigns/{campaignId}/ai-insights` analyzes only that brand's own campaign and completed history. Performance estimates require at least three similar completed outcomes with actual spend and view data.
- `POST /api/v1/wallet/intelligence` analyzes the authenticated brand's own payment, refund, campaign, and real daily budget snapshot data. The existing frontend path `POST /api/v1/ai/wallet/intelligence` remains available as a compatibility alias. Optional `campaignId` and `transactionId` are owner-scoped; the former enables campaign exhaustion estimates and the latter ties refund-method guidance to the original completed deposit method. Fraud results are advisory.
- `GET /api/v1/campaigns/{campaignId}/analytics` now includes `viewIntelligence`, calculated from seven-day submission snapshots and matured confirmed earnings in the creator ledger. It separates views pending the seven-day hold from validated/matured views, gives trend and geography explanations, and includes optional estimated gross and creator-net earnings separately from confirmed ledger earnings. Estimates use the current CPM and remaining budget; an out-of-target country is an analytics anomaly, not evidence of fraud.
- `POST /api/v1/creator/withdrawals/intelligence` gives the authenticated creator an advisory withdrawal-pattern assessment using only that creator's own withdrawal history and active payment methods. With insufficient history, risk and processing time are reported as unknown/insufficient rather than treated as low risk or predicted.
- `GET /api/v1/creator/earnings/prediction` estimates the authenticated creator's next-seven-day views, gross amount, and net amount by campaign. It uses only that creator's matured `CLEAR`/`CONFIRMED` view snapshots in the seven complete UTC date buckets from 14 to 7 days ago, each campaign's current CPM, and confirmed ledger realizations; recent views inside the seven-day hold are excluded. Results with fewer than four daily observations or no confirmed gross/net baseline are `INSUFFICIENT_DATA`. The existing wallet balances remain the confirmed amounts; these estimates are not withdrawable and never alter the ledger.
- `POST /api/v1/ai/language/detect` and `POST /api/v1/ai/language/translate` provide authenticated Arabic/English language detection and bounded translation. There is no existing standalone translation screen; clients should call these APIs from an existing text workflow when one requires translation.
- `GET /api/v1/campaigns/{campaignId}/report-summary` is available only to the owning brand. The chatbot uses aggregate confirmed report counts and does not receive reporter identities or report text.
- `GET /api/v1/campaigns/{campaignId}/applications/ai-ranking` is available only to the brand that owns the campaign. It ranks pending applications using the campaign brief/categories/target countries, measured view-country data (with creator-declared country preferences as fallback), content categories, and matured validated-view history. It reports age/gender coverage as unavailable, never infers demographics, does not accept/reject applications, and is capped at 200 pending applicants per response.
- `POST /api/v1/reports/{id}/ai-triage` is Admin-only. It classifies a confirmed report using the existing report reason taxonomy, estimates review urgency, compares details with up to 50 confirmed non-dismissed reports for the same campaign or clip, and returns reviewer suggestions. Main Backend redacts common email, URL, and phone patterns before sending report text to AI. All output remains advisory and requires human review; the route does not mutate report state.
- The existing campaign statistics page now displays owner-scoped performance estimates, archived campaign outcomes, successful category patterns, and policy acceptance analytics when available. All estimates are advisory, and acceptance of a pledge is not treated as proof of policy compliance.

## Sprint 8–10 coverage and limits

- **Sprint 8:** Withdrawal repeat/frequency and unusual-amount signals, behavior context, country-supported active payout-method suggestions, and processing-time medians are exposed by the creator withdrawal intelligence route. Historical thresholds require actual creator data; withdrawal intelligence never triggers or blocks a payout.
- **Sprint 9:** The existing authenticated assistant uses bounded, user-owned conversation history, role-scoped tools, Arabic/English responses, feedback-derived concise-response preference, and suggested actions. Brand tools expose owner-scoped campaign, budget/fraud, aggregate report, and dashboard data; creator earnings tools are clipper-only. A daily job may add a deduplicated in-app performance alert when a campaign has sufficient validated-view history and a significant drop. Campaign forecast and geographic analytics remain available through existing analytics/AI routes.
- **Sprint 10:** Campaign insights include owner-relative archived history and successful category patterns. Policy acceptance insights use actual pledges and explicitly do not infer actual compliance. Payment fraud and country-method recommendations reuse the existing wallet intelligence API. The language routes provide dynamic Arabic/English translation and detection.
- **Optional AI features:** Advertiser-side applicant ranking and administrator report triage are integrated with the AI Service through the internal `X-Service-Key` client. Existing video summaries/quality ranking, withdrawal intelligence, and successful campaign pattern analysis are reused. Creator earnings forecasts use the existing matured view and ledger data and are separate from confirmed wallet balances.
- **Not implemented pending data-source dependency:** Backup anomaly detection and storage issue prediction require real backup/job-health and storage capacity/error telemetry. No such inventory or monitoring source exists in the current application, so the service does not fabricate predictions.
- **Frontend dependency:** Translation has authenticated backend/API support but no suitable existing translation input workflow was found. No new page or standalone interface was added.
- Live provider behavior still depends on deployment credentials/configuration. Automated tests mock Gemini/backend calls and do not establish that production Gemini credentials or external payment-provider availability work.

The AI Service endpoints are internal and require `X-Service-Key`; that credential is never sent to browsers. Country-specific payment recommendations require the backend deployment's `PAYMENT_METHODS_BY_COUNTRY` mapping to reflect actually configured provider availability. Budget estimates remain `INSUFFICIENT_DATA` until the daily reset job has recorded enough real UTC-day snapshots. Creator recommendations recompute from current profile, favorites, applications, and (when configured) a bounded AI embedding rank on each request; there is no stale persisted model to refresh.

The Sprint 3 specification's campaign-history prediction is a **deposit amount** estimate. The word “shipping” appears only in the general payment processing-time SRS line and is not implemented as a fee or shipping prediction.

## Async submission lifecycle

`POST /api/v1/campaigns/{campaignId}/submissions` starts background processing. The initial response can contain `PROCESSING`; poll `GET /api/v1/submissions/{id}` for the current `displayStatus`. Current lifecycle values include `AI_REJECTED`, `MANUAL_REVIEW`, `AWAITING_ADVERTISER`, `APPROVED`, `REJECTED`, and `WITHDRAWN`. An AI submission check that lacks video/audio evidence remains in manual review. The campaign `auto-recharge` route is documented as a deferred endpoint that returns 501.

The current submission workflow stores a social post URL and provider metadata; it does not persist submitted video bytes or trusted frames. The AI Service has a separate internal asynchronous video upload/analysis API documented by its own Swagger UI. Main Backend cannot automatically start that analysis until the platform supplies a trusted video-byte ingestion source.

## Keeping the contract current

`npm run openapi:generate` rebuilds the contract from the mounted Express router inventory and the route-specific contract metadata in `scripts/generateOpenApi.js`. When adding or moving a router, update its mount mapping and roles, request schema, response examples, and status codes in that generator. The inventory intentionally excludes the unmounted legacy `wallet/walletAdmin.routes.js` file.

Run `npm run openapi:validate` to verify YAML syntax, local `$ref` targets, path parameters, tag metadata, operation response definitions, and exact mounted-route coverage. The `openApiDocs.test.js` suite also requests all three HTTP URLs and compares the served operation set to the mounted route inventory.

Swagger UI and ReDoc load their interface assets from their public CDNs; `/openapi.json` itself is served locally and contains no API credentials.
