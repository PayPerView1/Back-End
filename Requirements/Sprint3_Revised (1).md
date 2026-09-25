# Sprint 3: Budget and Payments (Brand/Advertiser)

> **Document type:** Sprint requirements and milestone specification
> **Sprint:** Sprint 3
> **Version:** MVP Revised
> **Last updated:** Based on pre-sprint planning decisions

---

## MVP Scope Decisions (Pre-Sprint)

The following decisions were made before sprint execution and govern all requirements and tasks in this document:

| Decision | Value |
|---|---|
| Currency | USD only (`currency VARCHAR DEFAULT 'USD'`, extensible later) |
| Payment gateways | PayPal Sandbox + Manual Bank Transfer only |
| Mada / STC Pay / Moyasar | Deferred post-MVP |
| Commission model | Deducted from advertiser deposit at time of funding |
| Campaign resume after recharge | Manual by default; configurable per campaign |
| Refund conditions | No active campaigns drawing from requested amount + no reserved balance + amount ≤ available balance |
| Refund processing time | 24–48 hours manual review + gateway processing time |
| Refund method | Same original payment method only |
| Webhook idempotency | `reference_id` UNIQUE constraint (simple, sufficient for MVP) |
| Refund cancellation after approval | Not allowed in MVP |
| AI features | Handled by AI Engineer (separate track) |
| Auto-Recharge | Deferred |
| Bulk Recharge | Deferred |
| WebSocket real-time updates | Deferred (polling sufficient) |
| Infinite Scroll | Deferred (standard pagination) |
| Refund fees | $0 in MVP (fee column exists in schema for future use) |
| Financial settlement | Manual daily review |
| campaign_budget_log table | Deferred (inferred from transactions table) |
| Multi-currency / exchange rate | Deferred |

---

## Overview and Primary Objective

Sprint 3 delivers core budget management and payment processing capabilities for advertisers within an MVP scope. The primary objective is to enable wallet funding via PayPal Sandbox and manual bank transfer, platform commission deduction at funding time, campaign budget allocation and daily limit management, automated campaign pausing, basic transaction history viewing, and manual refund processing.

---

## Allocated Functional Requirements

- **R1.23 (Funding):** The system shall allow advertisers to fund their e-wallet via PayPal (Sandbox) or manual bank transfer. Upon successful funding, the platform commission shall be deducted immediately and the net amount credited to the wallet balance.

- **R1.24 (Daily Budget Limit):** The system shall allow advertisers to set an optional daily spending limit per campaign. When the daily limit is reached, the campaign is automatically paused until the next day (UTC midnight). The campaign resumes automatically the next day if total budget remains.

- **R1.25 (Automatically Pausing the Campaign When the Budget Runs Out):** The campaign shall be automatically paused when the total allocated campaign budget is exhausted. Resuming after recharge is manual by default; advertisers may configure the campaign to resume automatically upon recharge.

- **R1.26 (Recharging the Campaign):** The system shall allow advertisers to transfer additional budget from their wallet to a specific campaign (active or paused) with a single action.

- **R1.27 (Viewing Transaction History):** The system shall display a paginated history of all wallet transactions, filterable by type and status, with the ability to view individual transaction details.

- **R1.28 (Refunding Unused Balance):** The system shall allow advertisers to request a refund of available wallet balance (free balance only, excluding amounts reserved for active campaigns). Refund is processed via the same original payment method. No processing fee in MVP. Manual review within 24–48 hours. Cancellation of a request is allowed only while status is PENDING. Once approved, cancellation is not permitted.

---

## User Story Backlog

---

### US-BUDGET-01: Fund Wallet

**Story ID:** US-BUDGET-01
**Traces to:** R1.23
**Priority:** High
**Sprint:** Sprint 3

**User Story**
"As an advertiser, I want to fund my e-wallet using PayPal or bank transfer, so I can allocate budget to my campaigns after the platform deducts its commission."

---

#### Scenarios

**Scenario 1 — Happy Path: PayPal Funding**
1. Advertiser navigates to the Wallet section and clicks "Top Up."
2. Selects PayPal as payment method and enters an amount (min $10, max $10,000).
3. System creates a transaction record with status `PENDING` and stores `reference_id` from PayPal.
4. Advertiser is redirected to PayPal Sandbox to complete payment.
5. PayPal sends webhook to the platform upon success.
6. System verifies webhook signature and checks `reference_id` uniqueness (idempotency).
7. Platform commission is deducted; net amount is credited to wallet balance.
8. Transaction status updated to `COMPLETED`.
9. Email notification sent to advertiser with: gross amount, commission deducted, net credited, new balance.

**Scenario 2 — Happy Path: Manual Bank Transfer**
1. Advertiser selects "Bank Transfer," enters amount, and views platform bank details (IBAN, beneficiary name, bank name).
2. Advertiser uploads transfer receipt.
3. Transaction created with status `UNDER_REVIEW`.
4. Admin reviews receipt via admin API within 24–48 hours.
5. Upon approval: commission deducted, net amount credited, status → `COMPLETED`, email sent.
6. Upon rejection: status → `REJECTED`, reason recorded, email sent, balance unchanged.

**Scenario 3 — Amount Below Minimum**
1. Advertiser enters amount less than $10.
2. System rejects with: "Minimum top-up is $10."

**Scenario 4 — Amount Above Maximum**
1. Advertiser enters amount greater than $10,000.
2. System rejects with: "Maximum top-up per transaction is $10,000."

**Scenario 5 — PayPal Payment Failed**
1. PayPal webhook reports failed payment.
2. Wallet balance unchanged.
3. Transaction recorded as `FAILED` with gateway reason.
4. Email notification sent to advertiser.

**Scenario 6 — PayPal Payment Cancelled by User**
1. Advertiser cancels within PayPal interface.
2. Transaction recorded as `CANCELLED`.
3. Balance unchanged.

**Scenario 7 — Duplicate Webhook Received**
1. PayPal sends same webhook twice (same `reference_id`).
2. System detects existing `reference_id`, ignores second call, returns HTTP 200.
3. Balance not affected twice.

**Scenario 8 — Non-Numeric Amount Entered**
1. Advertiser enters text or symbols in amount field.
2. System rejects: "Please enter a valid numeric amount."

---

#### Acceptance Criteria

- Supported payment methods: PayPal (Sandbox), Manual Bank Transfer.
- Minimum deposit: $10. Maximum per transaction: $10,000.
- Platform commission is deducted from gross amount at time of funding; net amount credited to wallet.
- Commission amount and net credited are shown to advertiser before confirmation and in email notification.
- PayPal webhook signature must be verified before processing.
- `reference_id` must have a UNIQUE constraint; duplicate webhooks are silently ignored (idempotent).
- Bank transfer receipt upload required; status remains `UNDER_REVIEW` until admin approves.
- Transaction recorded for every attempt regardless of outcome, with appropriate status.
- Valid statuses: `PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`, `UNDER_REVIEW`.
- Email notification sent on: successful completion, failure, bank transfer approval/rejection.
- Single currency: USD.

---

#### Backend Tasks

- `POST /api/wallet/fund` — Initiate funding (validate amount, create PENDING transaction, initiate PayPal redirect or return bank details).
- `POST /api/wallet/paypal/webhook` — Receive and verify PayPal webhook, apply idempotency check, deduct commission, credit wallet.
- `POST /api/wallet/bank-transfer/upload` — Upload bank transfer receipt; create UNDER_REVIEW transaction.
- `PUT /api/admin/wallet/bank-transfer/{id}` — Admin approve or reject bank transfer; on approval deduct commission and credit wallet.
- `GET /api/wallet/transaction/{id}` — Query single transaction status.
- Amount validation (min/max).
- Commission deduction logic (configurable rate, applied at funding time).
- Email notification service integration.

---

#### Database

**Table: `wallets`**
```
id              UUID, PK
advertiser_id   UUID, FK → users
balance         DECIMAL(12,2), default 0  -- net available balance after commission
currency        VARCHAR(3), default 'USD'
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**Table: `transactions`**
```
id              UUID, PK
wallet_id       UUID, FK → wallets
type            ENUM('CREDIT', 'DEBIT', 'REFUND')
gross_amount    DECIMAL(12,2)             -- amount advertiser paid/requested
commission      DECIMAL(12,2), default 0  -- platform fee deducted
net_amount      DECIMAL(12,2)             -- amount credited/debited to wallet
currency        VARCHAR(3), default 'USD'
payment_method  ENUM('PAYPAL', 'BANK_TRANSFER')
status          ENUM('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'UNDER_REVIEW')
reference_id    VARCHAR(255), UNIQUE, NULLABLE  -- from payment gateway; idempotency key
description     TEXT
campaign_id     UUID, FK → campaigns, NULLABLE
created_at      TIMESTAMP
updated_at      TIMESTAMP
```
Indexes: `wallet_id`, `status`, `type`, `created_at`, `reference_id`.

**Table: `bank_transfers`**
```
id              UUID, PK
transaction_id  UUID, FK → transactions
receipt_url     VARCHAR(500)
reviewed_by     UUID, FK → users, NULLABLE
reviewed_at     TIMESTAMP, NULLABLE
status          ENUM('PENDING', 'APPROVED', 'REJECTED')
rejection_note  TEXT, NULLABLE
created_at      TIMESTAMP
```

**Table: `platform_ledger`**
```
id              UUID, PK
transaction_id  UUID, FK → transactions
commission      DECIMAL(12,2)
currency        VARCHAR(3), default 'USD'
created_at      TIMESTAMP
```
*Simple single-entry ledger. Double-entry deferred post-MVP.*

Migration scripts and indexes to be written as part of Phase 1.

---

#### AI Engineer Tasks

- Analyze payment behavior to detect fraud.
- Recommend the best payment method based on the advertiser's location.
- Predict the appropriate deposit amount based on campaign history.

---

### US-BUDGET-02: Manage Campaign Budget

**Story ID:** US-BUDGET-02
**Traces to:** R1.24, R1.25, R1.26
**Priority:** High
**Sprint:** Sprint 3

**User Story**
"As an advertiser, I want to allocate budget from my wallet to a campaign, set an optional daily spending limit, recharge the campaign when needed, and have it automatically pause when budget runs out, so I can control my spending."

---

#### Scenarios

**Scenario 1 — Happy Path: Allocate Budget to Campaign**
1. Advertiser creates or edits a campaign and enters a budget amount.
2. System checks wallet balance ≥ requested amount.
3. Amount deducted from wallet, allocated to campaign budget.
4. Transaction recorded as `DEBIT` type.

**Scenario 2 — Happy Path: Set Daily Limit**
1. Advertiser sets optional daily limit on a campaign (e.g., $50/day).
2. System validates limit ≤ total campaign budget.
3. Limit saved. Each day at UTC midnight, `daily_budget_spent` resets to 0 and campaign resumes if paused by daily limit only.

**Scenario 3 — Happy Path: Recharge Campaign**
1. Advertiser clicks "Recharge" on a campaign and enters an amount.
2. System checks wallet balance ≥ entered amount.
3. Amount deducted from wallet, added to campaign budget.
4. If campaign was paused due to budget exhaustion AND campaign is configured for auto-resume → campaign status set to ACTIVE.
5. If manual-resume setting → campaign stays paused, advertiser must resume manually.
6. Transaction recorded.
7. Success message shown.

**Scenario 4 — Automatic Pause: Total Budget Exhausted**
1. Campaign is active; budget consumed per view/action.
2. Campaign budget reaches $0.
3. System automatically sets campaign status to `PAUSED`.
4. Email notification sent to advertiser.
5. "Recharge" button visible in dashboard.

**Scenario 5 — Automatic Pause: Daily Limit Reached**
1. Campaign's `daily_budget_spent` reaches `daily_budget_limit`.
2. Campaign temporarily paused until UTC midnight.
3. Notification sent to advertiser.
4. At UTC midnight: `daily_budget_spent` resets, campaign resumes automatically (if total budget > 0).

**Scenario 6 — Recharge: Insufficient Wallet Balance**
1. Advertiser attempts to recharge with $200 but wallet balance is $150.
2. System rejects: "Insufficient wallet balance. Top up your wallet first."

**Scenario 7 — Manually Pause Campaign**
1. Advertiser clicks "Pause" on an active campaign.
2. Campaign status set to `MANUALLY_PAUSED`.
3. Budget preserved. Advertiser must manually resume.

**Scenario 8 — Recharge Technical Failure**
1. Recharge API call fails due to server error.
2. No funds deducted from wallet, campaign budget unchanged.
3. Error logged; advertiser sees: "Something went wrong. Please try again."

---

#### Acceptance Criteria

- Advertisers can allocate wallet balance to a campaign budget at creation or edit time.
- Wallet balance must be sufficient for allocation; transaction is atomic.
- Daily budget limit is optional; if set, must be ≤ total campaign budget.
- Campaign auto-pauses when total budget is exhausted.
- Campaign auto-pauses when daily limit is reached; auto-resumes at UTC midnight if total budget > 0.
- Campaign resume after recharge is manual by default; configurable per campaign (`auto_resume_on_recharge`).
- Recharge deducts from wallet and adds to campaign budget atomically.
- All budget movements recorded in `transactions` table with `campaign_id`.
- Email notification sent when campaign is paused due to budget exhaustion.
- Advertisers can manually pause and resume campaigns.
- Bulk recharge: deferred.
- Auto-recharge: deferred.
- AI daily limit recommendations: deferred.

---

#### Backend Tasks

- `PUT /api/campaigns/{id}/budget` — Allocate or update total budget (deduct from wallet atomically).
- `PUT /api/campaigns/{id}/daily-budget` — Set or update daily budget limit.
- `POST /api/campaigns/{id}/recharge` — Add budget from wallet to campaign; handle resume logic.
- `PUT /api/campaigns/{id}/pause` — Manually pause campaign.
- `PUT /api/campaigns/{id}/resume` — Manually resume campaign (validate budget > 0).
- Budget check logic executed at every consumption event.
- Scheduled job (every 5 minutes): scan active campaigns, pause those with budget ≤ 0.
- Scheduled job (daily at UTC midnight): reset `daily_budget_spent` to 0; resume campaigns paused by daily limit only.
- Email notification on auto-pause due to budget exhaustion.
- All wallet→campaign transfers are atomic (database transaction).

---

#### Database (additions to `campaigns` table)

```
total_budget             DECIMAL(12,2), default 0
budget_spent             DECIMAL(12,2), default 0
daily_budget_limit       DECIMAL(12,2), NULLABLE
daily_budget_spent       DECIMAL(12,2), default 0
daily_budget_reset_at    DATE, NULLABLE
status                   ENUM('ACTIVE', 'PAUSED', 'MANUALLY_PAUSED', 'ENDED')
pause_reason             ENUM('BUDGET_EXHAUSTED', 'DAILY_LIMIT_REACHED', 'MANUAL', NULL)
auto_resume_on_recharge  BOOLEAN, default false
wallet_id                UUID, FK → wallets
last_recharged_at        TIMESTAMP, NULLABLE
```

*`campaign_budget_log` table deferred; budget history inferred from `transactions` table using `campaign_id`.*

---

#### AI Engineer Tasks

- Build an optimal daily limit recommendation model based on campaign history.
- Analyze campaign performance to provide customized recommendations.
- Build an intelligent budget-running alert system (early prediction).
- Analyze spending patterns and detect anomalies.

---

### US-BUDGET-03: View Transaction History

**Story ID:** US-BUDGET-03
**Traces to:** R1.27
**Priority:** Medium
**Sprint:** Sprint 3

**User Story**
"As an advertiser, I want to view a paginated history of my wallet transactions, filtered by type or status, and view individual transaction details, so I can track my financial activity."

---

#### Scenarios

**Scenario 1 — Happy Path: View All Transactions**
1. Advertiser navigates to Transaction History.
2. System returns paginated list, newest first.
3. Each row shows: Date, Type, Gross Amount, Commission, Net Amount, Payment Method, Status.

**Scenario 2 — Filter by Type**
1. Advertiser selects type filter (CREDIT / DEBIT / REFUND).
2. List updates to show only matching transactions.

**Scenario 3 — Filter by Status**
1. Advertiser selects status filter.
2. List updates accordingly.

**Scenario 4 — View Transaction Details**
1. Advertiser clicks a transaction.
2. Detail view shows: ID, date/time, type, gross amount, commission, net amount, payment method, status, description, associated campaign (if any), receipt link (bank transfer).

**Scenario 5 — Empty State**
1. No transactions exist.
2. Message: "No transactions yet. Top up your wallet to get started."

---

#### Acceptance Criteria

- Paginated transaction list (standard pagination, not infinite scroll).
- Default sort: newest first.
- Filters: type (CREDIT, DEBIT, REFUND) and status — these two only in MVP.
- Each transaction shows: date, type, gross amount, commission deducted, net amount, payment method, status.
- Transaction detail view available.
- Access restricted to the authenticated advertiser's own transactions.
- Deferred: filter by payment method, date range filter, search by ID/description, export (CSV/Excel/PDF), real-time update via WebSocket, infinite scroll.

---

#### Backend Tasks

- `GET /api/wallet/transactions` — Return paginated transactions for authenticated advertiser; support `type` and `status` query params.
- `GET /api/wallet/transactions/{id}` — Return single transaction detail.
- Enforce ownership: advertiser sees only their own transactions.
- Standard pagination (`page`, `per_page`, default 20 per page).

---

### US-BUDGET-04: Request Refund

**Story ID:** US-BUDGET-04
**Traces to:** R1.28
**Priority:** Medium
**Sprint:** Sprint 3

**User Story**
"As an advertiser, I want to request a refund of my unused wallet balance, so I can recover my funds when I no longer need them."

---

#### Scenarios

**Scenario 1 — Happy Path: Submit Refund Request**
1. Advertiser goes to Wallet page, clicks "Request Refund."
2. System displays: available balance for refund (wallet balance minus any reserved amounts), and confirms: "No processing fee in this phase."
3. Advertiser enters amount and confirms.
4. System validates: amount ≤ free balance, no active campaigns drawing from this balance.
5. Amount placed in `PENDING` hold (deducted from available balance, not yet paid out).
6. Refund request created with status `PENDING`.
7. Email sent: "Your refund request has been received and is under review (24–48 hours)."
8. Transaction recorded as `REFUND` type with status `PENDING`.

**Scenario 2 — Admin Approves Refund**
1. Admin reviews request and approves via admin API.
2. Status → `APPROVED`.
3. Refund processed via original payment method (PayPal reversal or manual bank transfer).
4. Status → `COMPLETED` once payment is confirmed.
5. Email sent to advertiser.

**Scenario 3 — Admin Rejects Refund**
1. Admin rejects request with a reason.
2. Status → `REJECTED`.
3. Held amount returned to wallet balance immediately.
4. Email sent to advertiser with rejection reason.

**Scenario 4 — Advertiser Cancels Request (While PENDING)**
1. Advertiser clicks "Cancel Request" while status is `PENDING`.
2. Status → `CANCELLED`.
3. Held amount returned to wallet.
4. Email confirmation sent.

**Scenario 5 — Cancellation Attempted After Approval**
1. Advertiser attempts to cancel after status is `APPROVED` or `COMPLETED`.
2. System rejects: "This request can no longer be cancelled."

**Scenario 6 — Amount Exceeds Free Balance**
1. Advertiser enters amount greater than available free balance.
2. System rejects: "Requested amount exceeds available balance. Available: $X."

**Scenario 7 — Active Campaign Blocking Refund**
1. Advertiser has an active campaign with budget allocated.
2. Requested refund amount + reserved budget > wallet balance.
3. System rejects: "You have active campaigns with allocated budget. Pause campaigns or reduce refund amount."

**Scenario 8 — Partial Refund**
1. Advertiser requests $200 out of $500 available balance.
2. System accepts; remaining $300 stays in wallet.

---

#### Acceptance Criteria

- Refund is available only for free wallet balance (total balance minus amounts allocated to active campaigns).
- Minimum refund: $10.
- No processing fee in MVP (fee column present in schema for future use, value = 0).
- Refund method: same as original payment method (no alternative method selection in MVP).
- Requested amount placed on hold immediately upon submission.
- Manual admin review within 24–48 hours.
- Advertiser can cancel request only while status is `PENDING`.
- Cancellation after `APPROVED` or `COMPLETED` is not permitted.
- On rejection: held amount returns to wallet balance with reason provided.
- On approval: funds returned via original payment method.
- All refund requests recorded in transaction history.
- Email notifications: on submission, approval, rejection, cancellation.
- Deferred: processing fees, alternative refund methods, automated approval, inactive balance reminders.

---

#### Backend Tasks

- `POST /api/wallet/refund` — Submit refund request; validate free balance; place hold; create record.
- `PUT /api/admin/wallet/refund/{id}` — Admin approve or reject; handle balance accordingly.
- `DELETE /api/wallet/refund/{id}` — Advertiser cancel (only if PENDING); restore balance.
- `GET /api/wallet/refunds` — List advertiser's refund requests with status.
- Free balance calculation: `wallet.balance - SUM(active campaign budgets linked to this wallet)`.
- Email notifications for all status transitions.

---

#### Database

**Table: `refund_requests`**
```
id               UUID, PK
wallet_id        UUID, FK → wallets
transaction_id   UUID, FK → transactions
amount           DECIMAL(12,2)
fee              DECIMAL(12,2), default 0   -- reserved for future use
net_amount       DECIMAL(12,2)              -- same as amount in MVP (fee = 0)
refund_method    VARCHAR(50)                -- same as original payment method
status           ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED')
rejection_note   TEXT, NULLABLE
reviewed_by      UUID, FK → users, NULLABLE
reviewed_at      TIMESTAMP, NULLABLE
completed_at     TIMESTAMP, NULLABLE
created_at       TIMESTAMP
updated_at       TIMESTAMP
```
Indexes: `wallet_id`, `status`, `created_at`.
Migration scripts included in Phase 1 delivery.

---

#### AI Engineer Tasks

- Analyze refund behavior to detect fraud.
- Recommend the best refund method based on the advertiser's history.
- Predict the likelihood of a refund request to provide customized offers.

---

## Execution Timeline and Milestone Phases

Sprint 3: two-week timebox — **August 18, 2026 to August 27, 2026** (10 business days).

**Phase 1 — Payment Data Model (Aug 18–19)**
- Create and migrate: `wallets`, `transactions`, `bank_transfers`, `platform_ledger`, `refund_requests`.
- Add budget columns to `campaigns` table.
- Configure PayPal Sandbox credentials and webhook endpoint.
- Write all migration scripts and indexes.

**Phase 2 — Wallet & Funding (Aug 20–22)**
- Implement wallet funding API (PayPal Sandbox + manual bank transfer).
- Implement PayPal webhook receiver (signature verification, idempotency).
- Implement commission deduction logic at funding time.
- Implement admin bank transfer approval API.
- Email notifications for funding events.

**Phase 3 — Budget Management & Refunds (Aug 23–24)**
- Implement campaign budget allocation and recharge APIs.
- Implement daily budget limit logic and scheduled jobs (5-minute monitor + midnight reset).
- Implement campaign auto-pause logic.
- Implement refund request lifecycle (submit, approve, reject, cancel).
- Email notifications for budget and refund events.
- Implement transaction history API with type/status filters and pagination.

**Phase 4 — Integration, Testing & Review (Aug 25–26)**
- End-to-end PayPal Sandbox flow testing.
- Webhook idempotency and signature verification testing.
- Budget exhaustion and daily limit scheduled job testing.
- Refund lifecycle testing (all status transitions).
- Security review: authorization checks (advertisers access only their own data), admin-only endpoints.
- Sprint review and documentation update.

---

## Deferred to Post-MVP

The following items are explicitly out of scope for this sprint and documented here for future planning:

- Mada, STC Pay, Moyasar payment gateways.
- Multi-currency support and exchange rate handling.
- Bulk campaign recharge.
- Auto-recharge (threshold-based).
- Alternative refund methods (different from original payment).
- Processing fees for refunds.
- Double-entry ledger (platform_ledger is single-entry in MVP).
- campaign_budget_log table.
- Transaction history: filter by payment method, date range, search, export (CSV/Excel/PDF).
- WebSocket real-time transaction updates.
- Infinite scroll.
- Automated refund approval.
- Inactive balance reminders (6-month dormancy).
- Automated financial settlement and reports.
- Advanced webhook validation per gateway beyond reference_id UNIQUE constraint.
