# Sprint 3 — Tasks & Subtasks
> **Sprint:** Sprint 3 — Budget and Payments
> **Period:** August 18 – August 27, 2026
> **Phase 1 (Setup):** ✅ Completed

---

## Mohammed Tasks

---

### Phase 2 — Wallet & Funding (Aug 20 – Aug 22)

#### T-M-01: PayPal Sandbox Integration Service
- [ ] Create `src/services/wallet/paypal.service.js`
- [ ] Set up PayPal Sandbox credentials in `.env` (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`)
- [ ] Implement `createOrder(amount)` — creates PayPal order and returns redirect URL
- [ ] Implement `verifyWebhookSignature(headers, body)` — verifies PayPal webhook authenticity
- [ ] Implement `captureOrder(orderId)` — captures approved PayPal payment
- [ ] Write unit tests for signature verification

---

#### T-M-02: Wallet Funding Service
- [ ] Create `src/services/wallet/walletFunding.service.js`
- [ ] Implement `inititateFunding(advertiserId, amount, paymentMethod)`:
  - Validate amount (min $10, max $10,000)
  - Create `PENDING` transaction record
  - If `PAYPAL` → call `paypal.service.createOrder()` and return redirect URL
  - If `BANK_TRANSFER` → return bank details from env + transaction ID
- [ ] Implement `processPaypalWebhook(headers, body)`:
  - Verify signature via `paypal.service.verifyWebhookSignature()`
  - Check `referenceId` uniqueness (idempotency)
  - Calculate commission and netAmount
  - Credit wallet balance (atomic DB transaction)
  - Update transaction status → `COMPLETED`
  - Record entry in `platform_ledger`
  - Trigger email notification
- [ ] Implement `approveBankTransfer(bankTransferId, adminId)`:
  - Calculate commission and netAmount
  - Credit wallet balance (atomic DB transaction)
  - Update `bank_transfer` status → `APPROVED`
  - Update transaction status → `COMPLETED`
  - Record entry in `platform_ledger`
  - Trigger email notification
- [ ] Implement `rejectBankTransfer(bankTransferId, adminId, note)`:
  - Update `bank_transfer` status → `REJECTED`
  - Update transaction status → `FAILED`
  - Trigger email notification

---

#### T-M-03: Commission Logic
- [ ] Add `COMMISSION_RATE` to `.env` (e.g., `0.025` for 2.5%)
- [ ] Create `src/utils/wallet/commission.utils.js`
- [ ] Implement `calculateCommission(grossAmount)`:
  - Returns `{ commission, netAmount, commissionRate }`
- [ ] Write unit tests for edge cases (min amount, max amount, zero rate)

---

#### T-M-04: Wallet Funding Middleware & Validator
- [ ] Create `src/middlewares/wallet/walletValidation.middleware.js`
  - `validateFundingRequest` — checks amount type, min, max, paymentMethod enum
  - `validateBankTransferUpload` — checks file type (jpg, png, pdf), file size (max 5MB)
- [ ] Create `src/validators/wallet/walletFunding.validator.js`
  - Joi/express-validator schema for `POST /api/wallet/fund`
  - Joi/express-validator schema for `POST /api/wallet/bank-transfer/upload`

---

#### T-M-05: Email Notifications — Funding Events
- [ ] Add funding email templates to `src/services/emailService.js`:
  - `sendFundingSuccessEmail(advertiser, { grossAmount, commission, netAmount, newBalance, paymentMethod })`
  - `sendFundingFailedEmail(advertiser, { amount, reason })`
  - `sendBankTransferReceivedEmail(advertiser, { amount, transactionId })`
  - `sendBankTransferApprovedEmail(advertiser, { netAmount, newBalance })`
  - `sendBankTransferRejectedEmail(advertiser, { amount, note })`

---

### Phase 3 — Budget Management & Refunds (Aug 23 – Aug 24)

#### T-M-06: Campaign Budget Service
- [ ] Create `src/services/wallet/campaignBudget.service.js`
- [ ] Implement `allocateBudget(campaignId, advertiserId, amount)`:
  - Check wallet balance ≥ amount
  - Atomic: deduct from wallet + add to campaign `totalBudget` and `remainingBudget`
  - Record `DEBIT` transaction with `campaignId`
- [ ] Implement `setDailyBudgetLimit(campaignId, advertiserId, limit)`:
  - Validate limit ≤ campaign `totalBudget`
  - Update `dailyBudgetLimit` on campaign
- [ ] Implement `rechargeCampaign(campaignId, advertiserId, amount)`:
  - Check wallet balance ≥ amount
  - Atomic: deduct from wallet + add to campaign `remainingBudget` and `totalBudget`
  - Record `DEBIT` transaction with `campaignId`
  - If `autoResumeOnRecharge: true` AND `pauseReason: BUDGET_EXHAUSTED` → set status → `ACTIVE`
  - Log `BUDGET_RECHARGED` in `CampaignActivityLog`
- [ ] Implement `pauseCampaign(campaignId, advertiserId)`:
  - Validate campaign is not already paused
  - Set status → `MANUALLY_PAUSED`, `pauseReason` → `MANUAL`
  - Log `MANUALLY_PAUSED` in `CampaignActivityLog`
- [ ] Implement `resumeCampaign(campaignId, advertiserId)`:
  - Validate `remainingBudget > 0`
  - Set status → `ACTIVE`, clear `pauseReason`
  - Log `MANUALLY_RESUMED` in `CampaignActivityLog`
- [ ] Implement `setAutoResume(campaignId, advertiserId, autoResumeOnRecharge)`:
  - Update `autoResumeOnRecharge` flag on campaign

---

#### T-M-07: Budget Monitor Scheduled Job
- [ ] Create `src/jobs/budgetMonitor.job.js`
- [ ] Schedule: every 5 minutes (use `node-cron`)
- [ ] Logic:
  - Query all campaigns where `status: ACTIVE` AND `remainingBudget ≤ 0`
  - For each: set `status → PAUSED`, `pauseReason → BUDGET_EXHAUSTED`
  - Log `BUDGET_EXHAUSTED` in `CampaignActivityLog`
  - Trigger `sendBudgetExhaustedEmail()`
- [ ] Register job in `server.js`

---

#### T-M-08: Daily Budget Reset Scheduled Job
- [ ] Create `src/jobs/dailyBudgetReset.job.js`
- [ ] Schedule: daily at `00:00 UTC` (use `node-cron`)
- [ ] Logic:
  - Reset `dailyBudgetSpent = 0` and `dailyBudgetResetAt = today` for all campaigns
  - Query campaigns where `status: PAUSED` AND `pauseReason: DAILY_LIMIT_REACHED` AND `remainingBudget > 0`
  - For each: set `status → ACTIVE`, clear `pauseReason`
  - Log `DAILY_LIMIT_RESET` in `CampaignActivityLog`
- [ ] Register job in `server.js`

---

#### T-M-09: Wallet Refund Service
- [ ] Create `src/services/wallet/walletRefund.service.js`
- [ ] Implement `calculateFreeBalance(walletId)`:
  - `freeBalance = wallet.balance − SUM(remainingBudget of ACTIVE campaigns linked to wallet)`
- [ ] Implement `submitRefundRequest(advertiserId, amount)`:
  - Calculate `freeBalance`
  - Validate amount ≥ $10 and ≤ `freeBalance`
  - Check no active campaigns blocking refund
  - Deduct hold from wallet balance
  - Create `refund_request` record with status `PENDING`
  - Create `REFUND` transaction with status `PENDING`
  - Trigger email notification
- [ ] Implement `cancelRefundRequest(refundRequestId, advertiserId)`:
  - Validate status is `PENDING`
  - Return held amount to wallet balance
  - Set status → `CANCELLED`
  - Trigger email notification
- [ ] Implement `approveRefund(refundRequestId, adminId, note)`:
  - Set status → `APPROVED`
  - Trigger email notification
- [ ] Implement `rejectRefund(refundRequestId, adminId, note)`:
  - Return held amount to wallet balance
  - Set status → `REJECTED`
  - Trigger email notification

---

#### T-M-10: Wallet Refund Validator
- [ ] Create `src/validators/wallet/walletRefund.validator.js`
  - Schema for `POST /api/wallet/refund` (amount: number, min 10)
  - Schema for `PUT /api/admin/wallet/refund/:id` (action: APPROVE|REJECT, note: optional)

---

#### T-M-11: Email Notifications — Budget & Refund Events
- [ ] Add to `src/services/emailService.js`:
  - `sendBudgetExhaustedEmail(advertiser, { campaignName, campaignId })`
  - `sendRefundSubmittedEmail(advertiser, { amount, refundRequestId })`
  - `sendRefundApprovedEmail(advertiser, { amount, netAmount, refundMethod })`
  - `sendRefundRejectedEmail(advertiser, { amount, note })`
  - `sendRefundCancelledEmail(advertiser, { amount })`

---

### Phase 4 — Integration & Testing (Aug 25 – Aug 26)

#### T-M-12: Integration & Testing
- [ ] End-to-end test: PayPal Sandbox full flow (fund → webhook → balance updated)
- [ ] Test webhook idempotency (send same webhook twice → balance not doubled)
- [ ] Test webhook with invalid signature → rejected
- [ ] Test budget exhaustion → campaign auto-paused (trigger job manually)
- [ ] Test daily limit reset job
- [ ] Test refund lifecycle: submit → approve → completed
- [ ] Test refund lifecycle: submit → reject → balance restored
- [ ] Test refund cancel while PENDING
- [ ] Test refund cancel after APPROVED → rejected with correct error
- [ ] Verify all admin endpoints reject non-admin JWT with 403
- [ ] Verify advertisers cannot access other advertisers' data

---

## Baraah Tasks

> **Note:** Start after Phase 1 (Setup) is confirmed complete.
> Reference `API_CONTRACT_Sprint3.md` for all request/response structures.

---

### Phase 2 — Wallet & Funding Endpoints (Aug 20 – Aug 22)

#### T-B-01: Wallet Controller & Routes — Funding
- [ ] Create `src/controllers/wallet/walletFunding.controller.js`
- [ ] Create `src/routes/wallet/walletFunding.routes.js`
- [ ] Implement `GET /api/wallet`:
  - Call wallet service to fetch balance
  - Return wallet object
- [ ] Implement `GET /api/wallet/bank-details`:
  - Read bank details from env variables
  - Return static bank info object
- [ ] Implement `POST /api/wallet/fund`:
  - Apply `validateFundingRequest` middleware
  - Call `walletFunding.service.inititateFunding()`
  - Return appropriate response based on `paymentMethod`
- [ ] Implement `POST /api/wallet/paypal/webhook`:
  - No auth middleware (PayPal calls this directly)
  - Pass raw headers and body to `walletFunding.service.processPaypalWebhook()`
  - Always return 200 (even on duplicate)
- [ ] Implement `POST /api/wallet/bank-transfer/upload`:
  - Apply `uploadMiddleware` for file handling
  - Apply `validateBankTransferUpload` middleware
  - Save file, call service to link receipt to transaction
  - Return upload confirmation
- [ ] Implement `PUT /api/admin/wallet/bank-transfer/:id`:
  - Apply admin auth check
  - Call `walletFunding.service.approveBankTransfer()` or `rejectBankTransfer()`
  - Return result

---

### Phase 3 — Transaction History, Budget & Refund Endpoints (Aug 23 – Aug 24)

#### T-B-02: Transaction History Controller & Routes
- [ ] Create `src/controllers/wallet/transactionHistory.controller.js`
- [ ] Create `src/routes/wallet/transactionHistory.routes.js`
- [ ] Implement `GET /api/wallet/transactions`:
  - Extract `type`, `status`, `page`, `perPage` from query params
  - Silently ignore: `paymentMethod`, `dateFrom`, `dateTo`, `search`
  - Call transaction service to fetch paginated results
  - Return paginated response
- [ ] Implement `GET /api/wallet/transactions/:id`:
  - Fetch single transaction
  - Verify transaction belongs to authenticated advertiser
  - Return transaction detail
- [ ] Implement `GET /api/wallet/transactions/export`:
  - Fetch all matching transactions (applying type/status filters)
  - Generate Excel file
  - Return as file download with correct headers

---

#### T-B-03: Wallet Refund Controller & Routes
- [ ] Create `src/controllers/wallet/walletRefund.controller.js`
- [ ] Create `src/routes/wallet/walletRefund.routes.js`
- [ ] Implement `POST /api/wallet/refund`:
  - Apply refund validator middleware
  - Call `walletRefund.service.submitRefundRequest()`
  - Return created refund request
- [ ] Implement `DELETE /api/wallet/refund/:id`:
  - Call `walletRefund.service.cancelRefundRequest()`
  - Return cancellation confirmation
- [ ] Implement `GET /api/wallet/refunds`:
  - Fetch paginated list of advertiser's refund requests
  - Return paginated response
- [ ] Implement `PUT /api/admin/wallet/refund/:id`:
  - Apply admin auth check
  - Apply refund admin validator
  - Call `walletRefund.service.approveRefund()` or `rejectRefund()`
  - Return result

---

#### T-B-04: Campaign Budget Controller & Routes
- [ ] Add budget endpoints to campaign routes (or create `src/routes/wallet/campaignBudget.routes.js`)
- [ ] Implement `PUT /api/campaigns/:id/budget`:
  - Call `campaignBudget.service.allocateBudget()`
  - Return updated budget info
- [ ] Implement `PUT /api/campaigns/:id/daily-budget`:
  - Call `campaignBudget.service.setDailyBudgetLimit()`
  - Return updated daily limit info
- [ ] Implement `POST /api/campaigns/:id/recharge`:
  - Call `campaignBudget.service.rechargeCampaign()`
  - Return recharge result with `autoResumed` flag
- [ ] Implement `PUT /api/campaigns/:id/pause`:
  - Call `campaignBudget.service.pauseCampaign()`
  - Return updated status
- [ ] Implement `PUT /api/campaigns/:id/resume`:
  - Call `campaignBudget.service.resumeCampaign()`
  - Return updated status
- [ ] Implement `PUT /api/campaigns/:id/auto-resume`:
  - Call `campaignBudget.service.setAutoResume()`
  - Return updated setting
- [ ] Implement `PUT /api/campaigns/:id/auto-recharge`:
  - Return `501 Not Implemented` response directly (no service call needed)

---

### Phase 4 — Integration & Testing (Aug 25 – Aug 26)

#### T-B-05: Integration & Testing
- [ ] Test `GET /api/wallet` returns correct balance
- [ ] Test `POST /api/wallet/fund` with amount below $10 → `AMOUNT_TOO_LOW`
- [ ] Test `POST /api/wallet/fund` with amount above $10,000 → `AMOUNT_TOO_HIGH`
- [ ] Test `POST /api/wallet/fund` with non-numeric amount → `VALIDATION_ERROR`
- [ ] Test `POST /api/wallet/bank-transfer/upload` with invalid file type → `VALIDATION_ERROR`
- [ ] Test `POST /api/wallet/bank-transfer/upload` with file > 5MB → `VALIDATION_ERROR`
- [ ] Test `GET /api/wallet/transactions` with no filters → returns all
- [ ] Test `GET /api/wallet/transactions?type=CREDIT` → returns only CREDIT
- [ ] Test `GET /api/wallet/transactions?type=CREDIT&paymentMethod=PAYPAL` → paymentMethod silently ignored
- [ ] Test `GET /api/wallet/transactions/:id` with another advertiser's transaction ID → `NOT_FOUND`
- [ ] Test `GET /api/wallet/transactions/export` → returns Excel file
- [ ] Test `POST /api/wallet/refund` with amount < $10 → `AMOUNT_TOO_LOW`
- [ ] Test `POST /api/wallet/refund` with amount > free balance → `INSUFFICIENT_BALANCE`
- [ ] Test `DELETE /api/wallet/refund/:id` while status is `PENDING` → success
- [ ] Test `DELETE /api/wallet/refund/:id` while status is `APPROVED` → `REFUND_NOT_CANCELLABLE`
- [ ] Test `PUT /api/campaigns/:id/resume` with zero budget → `INSUFFICIENT_BALANCE`
- [ ] Test `PUT /api/campaigns/:id/auto-recharge` → `501`
- [ ] Test all advertiser endpoints without JWT → `401`
- [ ] Test all admin endpoints with advertiser JWT → `403`
