# API Contract — Sprint 3: Budget and Payments

> **Version:** MVP
> **Base URL:** `/api/v1`
> **Authentication:** All endpoints require `Authorization: Bearer <JWT>` unless marked `[PUBLIC]`
> **Admin endpoints:** Require JWT with `role: ADMIN`
> **Response format:** All responses follow `{ success: true/false, ... }`

---

## Response Envelope

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

### Paginated
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## Error Codes Reference

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body or params |
| `AMOUNT_TOO_LOW` | 400 | Below minimum allowed |
| `AMOUNT_TOO_HIGH` | 400 | Above maximum allowed |
| `INSUFFICIENT_BALANCE` | 400 | Wallet balance not enough |
| `ACTIVE_CAMPAIGN_EXISTS` | 400 | Refund blocked by active campaign |
| `DUPLICATE_WEBHOOK` | 200 | reference_id already processed |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Action not allowed for this role |
| `NOT_FOUND` | 404 | Resource not found |
| `REFUND_NOT_CANCELLABLE` | 409 | Refund already approved/completed |
| `NOT_IMPLEMENTED` | 501 | Feature deferred (auto-recharge) |
| `INTERNAL_ERROR` | 500 | Server error |

---

## 1. Wallet

### 1.1 Get Wallet Balance

Displayed on the wallet page header and campaign budget management screen.

```
GET /api/v1/wallet
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "balance": 24500.00,
    "currency": "USD",
    "updatedAt": "2026-08-20T10:00:00Z"
  }
}
```

---

### 1.2 Get Platform Bank Details

Called when advertiser selects "Bank Transfer" to display IBAN and beneficiary info.
Values are static and loaded from environment variables.

```
GET /api/v1/wallet/bank-details
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "bankName": "Bank Name",
    "beneficiaryName": "Platform Legal Name",
    "iban": "SA0000000000000000000000",
    "swiftCode": "XXXXXXXX",
    "currency": "USD",
    "note": "Please include your registered email in the transfer description"
  }
}
```

---

### 1.3 Initiate Wallet Funding

Validates amount, creates a PENDING transaction, and returns PayPal redirect URL or bank details.

```
POST /api/v1/wallet/fund
```

**Request Body**
```json
{
  "amount": 5000,
  "paymentMethod": "PAYPAL"
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `amount` | Number | Yes | min: 10, max: 10000, numeric only |
| `paymentMethod` | String | Yes | `PAYPAL` or `BANK_TRANSFER` |

**Response 201 — PayPal**
```json
{
  "success": true,
  "data": {
    "transactionId": "uuid",
    "paymentMethod": "PAYPAL",
    "grossAmount": 5000.00,
    "commissionRate": 0.025,
    "commission": 125.00,
    "netAmount": 4875.00,
    "currency": "USD",
    "status": "PENDING",
    "redirectUrl": "https://www.sandbox.paypal.com/checkoutnow?token=XXXX"
  }
}
```

**Response 201 — Bank Transfer**
```json
{
  "success": true,
  "data": {
    "transactionId": "uuid",
    "paymentMethod": "BANK_TRANSFER",
    "grossAmount": 5000.00,
    "commissionRate": 0.025,
    "commission": 125.00,
    "netAmount": 4875.00,
    "currency": "USD",
    "status": "UNDER_REVIEW",
    "bankDetails": {
      "bankName": "Bank Name",
      "beneficiaryName": "Platform Legal Name",
      "iban": "SA0000000000000000000000",
      "swiftCode": "XXXXXXXX"
    },
    "uploadReceiptUrl": "/api/wallet/bank-transfer/upload"
  }
}
```

**Error Responses**
```json
{ "success": false, "message": "Minimum top-up amount is $10", "code": "AMOUNT_TOO_LOW" }
{ "success": false, "message": "Maximum top-up amount is $10,000 per transaction", "code": "AMOUNT_TOO_HIGH" }
{ "success": false, "message": "Invalid payment method", "code": "VALIDATION_ERROR" }
```

---

### 1.4 PayPal Webhook

Receives PayPal payment confirmation. Verifies signature, applies idempotency check,
deducts commission, credits wallet.

```
POST /api/v1/wallet/paypal/webhook
```

**Headers**
```
PAYPAL-TRANSMISSION-ID: xxx
PAYPAL-TRANSMISSION-TIME: xxx
PAYPAL-TRANSMISSION-SIG: xxx
PAYPAL-CERT-URL: xxx
```

**Request Body** *(sent by PayPal)*
```json
{
  "event_type": "PAYMENT.CAPTURE.COMPLETED",
  "resource": {
    "id": "paypal_capture_id",
    "amount": { "value": "5000.00", "currency_code": "USD" },
    "custom_id": "our_transaction_uuid"
  }
}
```

**Processing Logic**
1. Verify PayPal signature
2. Check `resource.id` (referenceId) — if already exists → return 200 silently (idempotency)
3. Find transaction by `custom_id`
4. Deduct commission, calculate netAmount
5. Credit wallet balance (atomic)
6. Update transaction status → `COMPLETED`
7. Record in `platform_ledger`
8. Send email notification

**Response 200 — Success or Duplicate**
```json
{ "success": true }
```

**Response 400 — Signature Invalid**
```json
{ "success": false, "message": "Invalid webhook signature", "code": "FORBIDDEN" }
```

---

### 1.5 Upload Bank Transfer Receipt

Advertiser uploads receipt after completing bank transfer.

```
POST /api/v1/wallet/bank-transfer/upload
Content-Type: multipart/form-data
```

**Request Body**
| Field | Type | Required | Rules |
|---|---|---|---|
| `transactionId` | String (UUID) | Yes | Must belong to authenticated advertiser |
| `receipt` | File | Yes | jpg, png, pdf — max 5MB |

**Response 200**
```json
{
  "success": true,
  "data": {
    "bankTransferId": "uuid",
    "transactionId": "uuid",
    "receiptUrl": "https://storage.example.com/receipts/xxx.jpg",
    "status": "PENDING",
    "message": "Receipt uploaded. Your transfer will be reviewed within 24–48 hours."
  }
}
```

**Error Responses**
```json
{ "success": false, "message": "Transaction not found or does not belong to you", "code": "NOT_FOUND" }
{ "success": false, "message": "File size exceeds 5MB limit", "code": "VALIDATION_ERROR" }
{ "success": false, "message": "Invalid file type. Allowed: jpg, png, pdf", "code": "VALIDATION_ERROR" }
```

---

### 1.6 Admin: Review Bank Transfer

Admin approves or rejects a bank transfer. On approval: deducts commission, credits wallet.

```
PUT /api/v1/admin/wallet/bank-transfer/:id
```

**Request Body**
```json
{
  "action": "APPROVE",
  "note": "Optional note"
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `action` | String | Yes | `APPROVE` or `REJECT` |
| `note` | String | No | Required if action is `REJECT` |

**Response 200 — Approved**
```json
{
  "success": true,
  "data": {
    "bankTransferId": "uuid",
    "action": "APPROVED",
    "transactionId": "uuid",
    "grossAmount": 5000.00,
    "commission": 125.00,
    "netAmount": 4875.00,
    "newWalletBalance": 29375.00
  }
}
```

**Response 200 — Rejected**
```json
{
  "success": true,
  "data": {
    "bankTransferId": "uuid",
    "action": "REJECTED",
    "note": "Receipt is unclear, please resubmit"
  }
}
```

**Error Responses**
```json
{ "success": false, "message": "Bank transfer not found", "code": "NOT_FOUND" }
{ "success": false, "message": "Rejection note is required", "code": "VALIDATION_ERROR" }
```

---

## 2. Transaction History

### 2.1 List Transactions

Paginated list of wallet transactions. Supports filtering by `type` and `status`.
Additional filters (`paymentMethod`, `dateFrom`, `dateTo`, `search`) are accepted silently and ignored in MVP.

```
GET /api/v1/wallet/transactions
```

**Query Parameters**
| Param | Type | Required | Values |
|---|---|---|---|
| `type` | String | No | `CREDIT`, `DEBIT`, `REFUND` |
| `status` | String | No | `PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`, `UNDER_REVIEW` |
| `page` | Number | No | default: 1 |
| `perPage` | Number | No | default: 20, max: 100 |
| `paymentMethod` | String | No | Accepted, ignored in MVP |
| `dateFrom` | String | No | Accepted, ignored in MVP |
| `dateTo` | String | No | Accepted, ignored in MVP |
| `search` | String | No | Accepted, ignored in MVP |

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "CREDIT",
      "grossAmount": 5000.00,
      "commission": 125.00,
      "netAmount": 4875.00,
      "currency": "USD",
      "paymentMethod": "PAYPAL",
      "status": "COMPLETED",
      "description": "Wallet top-up via PayPal",
      "campaignId": null,
      "campaignName": null,
      "createdAt": "2026-08-20T10:00:00Z"
    },
    {
      "id": "uuid",
      "type": "DEBIT",
      "grossAmount": 1000.00,
      "commission": 0,
      "netAmount": 1000.00,
      "currency": "USD",
      "paymentMethod": null,
      "status": "COMPLETED",
      "description": "Budget allocated to campaign",
      "campaignId": "uuid",
      "campaignName": "Ramadan Campaign 2026",
      "createdAt": "2026-08-20T11:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

### 2.2 Get Transaction Detail

Full detail view for a single transaction, including receipt link for bank transfers.

```
GET /api/v1/wallet/transactions/:id
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "CREDIT",
    "grossAmount": 5000.00,
    "commission": 125.00,
    "netAmount": 4875.00,
    "currency": "USD",
    "paymentMethod": "BANK_TRANSFER",
    "status": "COMPLETED",
    "referenceId": "TXN-2026-08940",
    "description": "Wallet top-up via bank transfer",
    "campaignId": null,
    "campaignName": null,
    "receiptUrl": "https://storage.example.com/receipts/xxx.jpg",
    "createdAt": "2026-08-20T10:00:00Z",
    "updatedAt": "2026-08-21T09:00:00Z"
  }
}
```

**Error Responses**
```json
{ "success": false, "message": "Transaction not found", "code": "NOT_FOUND" }
```

---

### 2.3 Export Transactions (Excel)

Exports all transactions matching current filters as an Excel file.

```
GET /api/v1/wallet/transactions/export
```

**Query Parameters**
Same as `GET /api/wallet/transactions` (type, status, page ignored — exports all matching).

**Response 200**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="transactions_2026-08-20.xlsx"
[Binary Excel file]
```

**Error Response**
```json
{ "success": false, "message": "Export failed", "code": "INTERNAL_ERROR" }
```

---

## 3. Campaign Budget

### 3.1 Allocate / Update Campaign Budget

Transfers amount from wallet to campaign budget. Atomic operation.

```
PUT /api/v1/campaigns/:id/budget
```

**Request Body**
```json
{
  "amount": 1000.00
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `amount` | Number | Yes | > 0, ≤ wallet balance |

**Response 200**
```json
{
  "success": true,
  "data": {
    "campaignId": "uuid",
    "totalBudget": 1000.00,
    "remainingBudget": 1000.00,
    "budgetSpent": 0,
    "walletBalanceAfter": 23500.00,
    "transactionId": "uuid"
  }
}
```

**Error Responses**
```json
{ "success": false, "message": "Insufficient wallet balance", "code": "INSUFFICIENT_BALANCE" }
{ "success": false, "message": "Campaign not found", "code": "NOT_FOUND" }
{ "success": false, "message": "Amount must be greater than 0", "code": "VALIDATION_ERROR" }
```

---

### 3.2 Set / Update Daily Budget Limit

Sets or updates the daily spending limit for a campaign.

```
PUT /api/v1/campaigns/:id/daily-budget
```

**Request Body**
```json
{
  "dailyBudgetLimit": 75.00
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `dailyBudgetLimit` | Number | Yes | > 0, ≤ campaign totalBudget. Send `null` to remove limit |

**Response 200**
```json
{
  "success": true,
  "data": {
    "campaignId": "uuid",
    "dailyBudgetLimit": 75.00,
    "dailyBudgetSpent": 0,
    "message": "Daily budget limit set successfully"
  }
}
```

**Error Responses**
```json
{ "success": false, "message": "Daily limit cannot exceed total campaign budget", "code": "VALIDATION_ERROR" }
{ "success": false, "message": "Campaign not found", "code": "NOT_FOUND" }
```

---

### 3.3 Recharge Campaign Budget

Adds additional budget from wallet to a specific campaign (active or paused).
Respects `autoResumeOnRecharge` setting.

```
POST /api/v1/campaigns/:id/recharge
```

**Request Body**
```json
{
  "amount": 500.00
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `amount` | Number | Yes | > 0, ≤ wallet balance |

**Response 200**
```json
{
  "success": true,
  "data": {
    "campaignId": "uuid",
    "amountAdded": 500.00,
    "totalBudget": 1500.00,
    "remainingBudget": 1500.00,
    "walletBalanceAfter": 23000.00,
    "campaignStatus": "PAUSED",
    "autoResumed": false,
    "message": "Campaign recharged successfully. Resume the campaign manually when ready.",
    "transactionId": "uuid"
  }
}
```

*If `autoResumeOnRecharge: true` and campaign was paused due to budget exhaustion:*
```json
{
  "success": true,
  "data": {
    "campaignId": "uuid",
    "amountAdded": 500.00,
    "totalBudget": 1500.00,
    "remainingBudget": 1500.00,
    "walletBalanceAfter": 23000.00,
    "campaignStatus": "ACTIVE",
    "autoResumed": true,
    "message": "Campaign recharged and resumed automatically.",
    "transactionId": "uuid"
  }
}
```

**Error Responses**
```json
{ "success": false, "message": "Insufficient wallet balance", "code": "INSUFFICIENT_BALANCE" }
{ "success": false, "message": "Campaign not found", "code": "NOT_FOUND" }
```

---

### 3.4 Pause Campaign (Manual)

Advertiser manually pauses a campaign. Preserves remaining budget.

```
PUT /api/v1/campaigns/:id/pause
```

**Request Body:** None

**Response 200**
```json
{
  "success": true,
  "data": {
    "campaignId": "uuid",
    "status": "MANUALLY_PAUSED",
    "pauseReason": "MANUAL",
    "remainingBudget": 650.00
  }
}
```

**Error Responses**
```json
{ "success": false, "message": "Campaign not found", "code": "NOT_FOUND" }
{ "success": false, "message": "Campaign is already paused", "code": "VALIDATION_ERROR" }
```

---

### 3.5 Resume Campaign (Manual)

Advertiser manually resumes a paused campaign. Validates budget > 0 before resuming.

```
PUT /api/v1/campaigns/:id/resume
```

**Request Body:** None

**Response 200**
```json
{
  "success": true,
  "data": {
    "campaignId": "uuid",
    "status": "ACTIVE",
    "remainingBudget": 650.00
  }
}
```

**Error Responses**
```json
{ "success": false, "message": "Campaign not found", "code": "NOT_FOUND" }
{ "success": false, "message": "Cannot resume campaign with zero budget. Please recharge first.", "code": "INSUFFICIENT_BALANCE" }
{ "success": false, "message": "Campaign is not paused", "code": "VALIDATION_ERROR" }
```

---

### 3.6 Configure Auto-Resume on Recharge

Sets whether the campaign resumes automatically when recharged after budget exhaustion.

```
PUT /api/v1/campaigns/:id/auto-resume
```

**Request Body**
```json
{
  "autoResumeOnRecharge": true
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "campaignId": "uuid",
    "autoResumeOnRecharge": true
  }
}
```

---

### 3.7 Auto-Recharge Configuration (Deferred — Stub)

```
PUT /api/v1/campaigns/:id/auto-recharge
```

**Response 501**
```json
{
  "success": false,
  "message": "Auto-recharge is not available yet.",
  "code": "NOT_IMPLEMENTED"
}
```

---

## 4. Refund

### 4.1 Submit Refund Request

Validates free balance (wallet.balance − reserved campaign budgets),
places hold on requested amount, creates refund request.

```
POST /api/v1/wallet/refund
```

**Request Body**
```json
{
  "amount": 500.00
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `amount` | Number | Yes | min: 10, ≤ freeBalance |

**Free Balance Calculation:**
`freeBalance = wallet.balance − SUM(remainingBudget of ACTIVE campaigns linked to this wallet)`

**Response 201**
```json
{
  "success": true,
  "data": {
    "refundRequestId": "uuid",
    "transactionId": "uuid",
    "amount": 500.00,
    "fee": 0,
    "netAmount": 500.00,
    "refundMethod": "PAYPAL",
    "status": "PENDING",
    "walletBalanceAfter": 24000.00,
    "message": "Refund request submitted. It will be reviewed within 24–48 hours.",
    "createdAt": "2026-08-20T12:00:00Z"
  }
}
```

**Error Responses**
```json
{ "success": false, "message": "Minimum refund amount is $10", "code": "AMOUNT_TOO_LOW" }
{ "success": false, "message": "Requested amount exceeds available balance. Available: $X", "code": "INSUFFICIENT_BALANCE" }
{ "success": false, "message": "You have active campaigns with allocated budget. Please pause campaigns before requesting a refund.", "code": "ACTIVE_CAMPAIGN_EXISTS" }
```

---

### 4.2 Cancel Refund Request

Advertiser cancels their own refund request. Only allowed while status is `PENDING`.

```
DELETE /api/v1/wallet/refund/:id
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "refundRequestId": "uuid",
    "status": "CANCELLED",
    "walletBalanceAfter": 24500.00,
    "message": "Refund request cancelled. Amount returned to your wallet."
  }
}
```

**Error Responses**
```json
{ "success": false, "message": "Refund request not found", "code": "NOT_FOUND" }
{ "success": false, "message": "This refund request can no longer be cancelled.", "code": "REFUND_NOT_CANCELLABLE" }
```

---

### 4.3 List Refund Requests

Advertiser views their own refund request history.

```
GET /api/v1/wallet/refunds
```

**Query Parameters**
| Param | Type | Required | Default |
|---|---|---|---|
| `page` | Number | No | 1 |
| `perPage` | Number | No | 20 |

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "amount": 500.00,
      "fee": 0,
      "netAmount": 500.00,
      "refundMethod": "PAYPAL",
      "status": "PENDING",
      "createdAt": "2026-08-20T12:00:00Z",
      "updatedAt": "2026-08-20T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

---

### 4.4 Admin: Approve or Reject Refund

Admin reviews and acts on a refund request.
On approval: status → `APPROVED` then `COMPLETED` after payment is confirmed.
On rejection: held amount returned to wallet immediately.

```
PUT /api/v1/admin/wallet/refund/:id
```

**Request Body**
```json
{
  "action": "APPROVE",
  "note": "Optional internal note"
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `action` | String | Yes | `APPROVE` or `REJECT` |
| `note` | String | No | Required if `REJECT` |

**Response 200 — Approved**
```json
{
  "success": true,
  "data": {
    "refundRequestId": "uuid",
    "action": "APPROVED",
    "amount": 500.00,
    "netAmount": 500.00,
    "refundMethod": "PAYPAL",
    "status": "APPROVED",
    "message": "Refund approved. Funds will be returned within gateway processing time."
  }
}
```

**Response 200 — Rejected**
```json
{
  "success": true,
  "data": {
    "refundRequestId": "uuid",
    "action": "REJECTED",
    "note": "Active campaigns detected at review time.",
    "status": "REJECTED",
    "walletBalanceAfter": 25000.00,
    "message": "Refund rejected. Held amount returned to wallet."
  }
}
```

**Error Responses**
```json
{ "success": false, "message": "Refund request not found", "code": "NOT_FOUND" }
{ "success": false, "message": "Rejection note is required", "code": "VALIDATION_ERROR" }
{ "success": false, "message": "Refund already processed", "code": "REFUND_NOT_CANCELLABLE" }
```

---

## 5. Scheduled Jobs (Internal — No HTTP Endpoint)

These are internal background jobs, documented here for coordination between backend developers.

### 5.1 Budget Monitor Job
- **Schedule:** Every 5 minutes
- **Logic:** Scan all `ACTIVE` campaigns where `remainingBudget ≤ 0`
- **Action:** Set status → `PAUSED`, `pauseReason` → `BUDGET_EXHAUSTED`, send email notification
- **Log:** Record action in `CampaignActivityLog` with `action: BUDGET_EXHAUSTED`

### 5.2 Daily Budget Reset Job
- **Schedule:** Daily at `00:00 UTC`
- **Logic:** 
  1. Reset `dailyBudgetSpent = 0` and `dailyBudgetResetAt = today` for all campaigns
  2. For campaigns paused with `pauseReason: DAILY_LIMIT_REACHED` and `remainingBudget > 0` → set status → `ACTIVE`
- **Log:** Record `DAILY_LIMIT_RESET` in `CampaignActivityLog`

---

## 6. Endpoint Summary

| # | Method | Endpoint | Auth | Description |
|---|---|---|---|---|
| 1 | GET | `/api/v1/wallet` | Advertiser | Get wallet balance |
| 2 | GET | `/api/v1/wallet/bank-details` | Advertiser | Get platform bank info |
| 3 | POST | `/api/v1/wallet/fund` | Advertiser | Initiate wallet funding |
| 4 | POST | `/api/v1/wallet/paypal/webhook` | — | PayPal webhook receiver |
| 5 | POST | `/api/v1/wallet/bank-transfer/upload` | Advertiser | Upload bank transfer receipt |
| 6 | PUT | `/api/v1/admin/wallet/bank-transfer/:id` | Admin | Approve/reject bank transfer |
| 7 | GET | `/api/v1/wallet/transactions` | Advertiser | List transactions (paginated) |
| 8 | GET | `/api/v1/wallet/transactions/:id` | Advertiser | Transaction detail |
| 9 | GET | `/api/v1/wallet/transactions/export` | Advertiser | Export transactions as Excel |
| 10 | PUT | `/api/v1/campaigns/:id/budget` | Advertiser | Allocate/update campaign budget |
| 11 | PUT | `/api/v1/campaigns/:id/daily-budget` | Advertiser | Set daily budget limit |
| 12 | POST | `/api/v1/campaigns/:id/recharge` | Advertiser | Recharge campaign budget |
| 13 | PUT | `/api/v1/campaigns/:id/pause` | Advertiser | Manually pause campaign |
| 14 | PUT | `/api/v1/campaigns/:id/resume` | Advertiser | Manually resume campaign |
| 15 | PUT | `/api/v1/campaigns/:id/auto-resume` | Advertiser | Configure auto-resume setting |
| 16 | PUT | `/api/v1/campaigns/:id/auto-recharge` | Advertiser | Auto-recharge stub (501) |
| 17 | POST | `/api/v1/wallet/refund` | Advertiser | Submit refund request |
| 18 | DELETE | `/api/v1/wallet/refund/:id` | Advertiser | Cancel refund request |
| 19 | GET | `/api/v1/wallet/refunds` | Advertiser | List refund requests |
| 20 | PUT | `/api/v1/admin/wallet/refund/:id` | Admin | Approve/reject refund |