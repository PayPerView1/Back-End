# API Contract — Sprint 5: Content Production & Publishing (Content Creator)

> **Version:** MVP (draft 1, prepared before implementation)
> **Base URL:** `/api/v1`
> **Authentication:** `Authorization: Bearer <JWT>` unless marked `[PUBLIC-TOKEN]`
> **Roles:** `CLIPPER` (content creator), `BRAND` (advertiser), `ADMIN`
> **Response format:** same envelope as Sprint 3 / 4 — `{ success: true/false, ... }`
> **IDs:** MongoDB ObjectId strings (24 hex chars)
> **Dates:** ISO 8601 UTC strings — **Currency:** USD
> **Country codes:** alpha-3, unchanged from Sprint 4

---

## 0. Overview

```
Accepted creator
   │  1. download source materials (single-use signed links)         §3
   │  2. produce the clip off-platform, publish on TikTok / IG / YT
   ▼
Pick a campaign ready for delivery                                   §4.1
   │  3. paste the link → "Check link" (preview + requirements)      §4.3
   │  4. submit (or save as draft)                                   §4.4 / §5.1
   ▼
SUBMITTED ── AI review (async) ──┬─ APPROVED ───────► UNDER_REVIEW (advertiser)   ─► APPROVED / REJECTED
                                 ├─ REJECTED ───────► REJECTED (creator fixes the post → resubmit §5.6)
                                 └─ MANUAL_REVIEW ──► UNDER_REVIEW (admin) ─► advertiser stage / REJECTED
```

### Assumptions (change here first if any is wrong)

| # | Assumption |
|---|---|
| A1 | After AI approval the **advertiser still decides**. If they do not decide within `SUBMISSION_REVIEW_DEADLINE_HOURS` (default 24h) the submission is auto-approved (`ENABLE_SUBMISSION_AUTO_APPROVE=true`) |
| A2 | Max **5 active** submissions per creator per campaign (`SUBMISSION_MAX_ACTIVE_PER_CAMPAIGN`). Rejected and withdrawn ones do not count. A campaign may override it with `maxSubmissionsPerCreator` |
| A3 | A video is unique platform-wide by `(platform, externalId)`, not by URL text. A rejected / withdrawn submission releases its link |
| A4 | After an AI/advertiser rejection the creator fixes the post and calls **resubmit**, which creates a **new** submission (`attempt + 1`) linked to the old one |
| A5 | **Rewards are not part of Sprint 5.** Every submission returns `"reward": null`. Payout logic comes in the earnings sprint |
| A6 | Likes / comments / shares are returned only when the platform exposes them (YouTube). For TikTok/Instagram they are `null` and the UI must hide them |
| A7 | Instagram content cannot be verified server-side in the MVP (`fetchStatus: "UNAVAILABLE"`). Such submissions skip hashtag blocking and go through AI / manual review |
| A8 | Download links are app-level signed, single-use and short-lived. The files themselves stay public on Cloudinary in this sprint (see §10) |
| A9 | Campaigns without `submissionRequirements` set by the brand have **no blocking hashtag/mention rules** |

---

## 1. Error Codes (new in Sprint 5)

Errors may now include an optional `details` object:
```json
{ "success": false, "message": "...", "code": "ERROR_CODE", "details": { } }
```

| Code | HTTP | Meaning |
|---|---|---|
| `INVALID_LINK` | 400 | Malformed link, post not found (`details.httpStatus`), or not a supported URL shape (`details.hint`: `SHORTS_URL_REQUIRED` / `VIDEO_URL_REQUIRED`) |
| `UNSUPPORTED_PLATFORM` | 400 | Host is not TikTok / Instagram Reels / YouTube Shorts (e.g. Facebook) |
| `PLATFORM_MISMATCH` | 400 | The link belongs to a different platform than the one selected (`details.detected`) |
| `POST_NOT_PUBLIC` | 422 | Post exists but the account/post is private |
| `CONTENT_REQUIREMENTS_NOT_MET` | 422 | Post lacks required hashtags / keywords / mentions or breaks duration rules. `details` lists what is missing |
| `LINK_ALREADY_SUBMITTED` | 409 | Same video already submitted. `details` is filled **only** when it is the same creator's submission |
| `SUBMISSION_LIMIT_REACHED` | 409 | Creator reached the active-submissions limit for this campaign |
| `SUBMISSION_NOT_WITHDRAWABLE` | 409 | Submission can no longer be withdrawn |
| `SUBMISSION_NOT_EDITABLE` | 409 | Link update / resubmit not allowed in the current state |
| `SUBMISSION_ALREADY_REVIEWED` | 409 | Brand/admin decision already taken |
| `DOWNLOAD_LINK_EXPIRED` | 410 | Download link expired or already used |
| `APPLICATION_NOT_ACCEPTED` | 403 | Creator is not accepted into this campaign |

Reused: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CAMPAIGN_UNAVAILABLE`, `TOO_MANY_REQUESTS`, `INTERNAL_ERROR`.

---

## 2. Enums

| Name | Values |
|---|---|
| `platform` | `TIKTOK`, `INSTAGRAM`, `YOUTUBE` |
| `status` (stored) | `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `WITHDRAWN` |
| `displayStatus` (computed — **use this in the UI**) | `PROCESSING`, `AI_REJECTED`, `MANUAL_REVIEW`, `AWAITING_ADVERTISER`, `APPROVED`, `REJECTED`, `WITHDRAWN` |
| `aiReview.status` | `PENDING`, `APPROVED`, `REJECTED`, `MANUAL_REVIEW_REQUIRED` |
| `advertiserReview.status` | `PENDING`, `APPROVED`, `REJECTED`, `AUTO_APPROVED` |
| `rejectedBy` | `AI`, `RULES`, `ADVERTISER`, `ADMIN` |
| `check.status` | `PASSED`, `FAILED`, `NEEDS_REVIEW`, `SKIPPED` |
| `check.source` | `RULES` (backend), `AI` |
| `fetchStatus` | `OK`, `UNAVAILABLE`, `NOT_FOUND`, `PRIVATE` |
| `tab` (eligible campaigns) | `ALL`, `READY`, `ENDING_SOON` |
| `download.status` | `REQUESTED`, `STARTED`, `COMPLETED`, `FAILED` |

Known `check.code` values (the UI translates by code; unknown codes must be rendered with `message`):
`LINK_REACHABLE`, `VIDEO_FORMAT`, `DURATION`, `AUDIO_COMPLIANCE`, `REQUIRED_HASHTAGS`, `REQUIRED_KEYWORDS`, `OFFICIAL_MENTION`, `LOGO_VISIBLE`, `AUDIO_CLARITY`, `PRESENTATION_QUALITY`, `BRIEF_ALIGNMENT`, `COMMERCIAL_ELEMENTS`.

Mapping of `displayStatus` to the screens:

| displayStatus | Screen |
|---|---|
| `PROCESSING` | Received, AI check running (step 2 active) |
| `AWAITING_ADVERTISER` | "AI approved — waiting for advertiser" |
| `AI_REJECTED` | "Clip does not meet the conditions" + fix list |
| `MANUAL_REVIEW` | "Under manual review" |
| `APPROVED` / `REJECTED` / `WITHDRAWN` | Final states |

---

## 3. Source Materials & Downloads — `CLIPPER` (accepted creators only)

### 3.1 List Materials (changed from Sprint 4 §4.4)

```
GET /api/v1/applications/:id/materials
```
**Rules:** application must belong to the caller **and** be `ACCEPTED`; campaign must not be cancelled, suspended or archived.

**Response 200**
```json
{
  "success": true,
  "data": {
    "applicationId": "66f1c0000000000000000001",
    "campaignId": "66f1a2b3c4d5e6f708192a3b",
    "summary": { "count": 2, "totalSizeKb": 9400 },
    "canDownloadAll": true,
    "items": [
      {
        "id": "66f1a2b3c4d5e6f708192a40",
        "fileName": "intro.mp4",
        "fileType": "VIDEO",
        "mimeType": "video/mp4",
        "fileSizeKb": 8200,
        "previewUrl": "https://res.cloudinary.com/.../w_480,q_auto:low/.../intro.mp4"
      }
    ]
  }
}
```
> ⚠️ **Breaking change:** `downloadUrl` is **removed** from items. Use §3.2 / §3.3 to get a link. `items: []` → empty state "No materials available".

**Errors:** `403 APPLICATION_NOT_ACCEPTED`, `404 NOT_FOUND`, `409 CAMPAIGN_UNAVAILABLE`.

### 3.2 Get a Download Link for One File

```
POST /api/v1/applications/:id/materials/:materialId/download-link
```
No body. Creates a `DownloadLog` (status `REQUESTED`) and returns a single-use link valid for `DOWNLOAD_LINK_TTL_SECONDS` (default 300).

**Response 201**
```json
{
  "success": true,
  "data": {
    "logId": "66f1f0000000000000000001",
    "materialId": "66f1a2b3c4d5e6f708192a40",
    "fileName": "intro.mp4",
    "fileSizeKb": 8200,
    "url": "https://api.example.com/api/v1/materials/download/eyJhbGciOi...",
    "expiresAt": "2026-10-25T10:05:00.000Z"
  }
}
```
**Errors:** `403 APPLICATION_NOT_ACCEPTED`, `404 NOT_FOUND` (application or material), `409 CAMPAIGN_UNAVAILABLE`.

### 3.3 Download All

```
POST /api/v1/applications/:id/materials/download-all
```
**Response 201** — one link per file (the frontend downloads them sequentially and drives the progress bar):
```json
{
  "success": true,
  "data": {
    "strategy": "FILES",
    "totalSizeKb": 9400,
    "items": [
      { "logId": "...", "materialId": "...", "fileName": "intro.mp4", "fileSizeKb": 8200, "url": "...", "expiresAt": "..." }
    ]
  }
}
```
`strategy` may become `"ARCHIVE"` later (single ZIP link) — the frontend should branch on it.

### 3.4 Redeem a Link `[PUBLIC-TOKEN]`

```
GET /api/v1/materials/download/:token
```
Valid → logs the download (`STARTED`, `consumedAt`), writes **one** `MATERIALS_DOWNLOADED` entry in the campaign activity log per creator per campaign (first download only), and answers **`302`** to the file with `Content-Disposition: attachment`.

**Errors (JSON):** `410 DOWNLOAD_LINK_EXPIRED` (expired or already used), `403 FORBIDDEN` (access revoked meanwhile, e.g. campaign cancelled).

### 3.5 Report Download Result (optional)

Lets the frontend show the "download completed / failed" notifications from the design.
```
PATCH /api/v1/downloads/:logId
```
```json
{ "status": "COMPLETED" }
```
`status`: `COMPLETED` or `FAILED` (with optional `reason`, max 200 chars). Only the owner can update; each log can be reported once.

**Response 200**
```json
{ "success": true, "data": { "id": "66f1f0000000000000000001", "status": "COMPLETED" } }
```
Creates a `DOWNLOAD_COMPLETED` / `DOWNLOAD_FAILED` in-app notification.
**Errors:** `404 NOT_FOUND` (also for another user's log), `409 CONFLICT` (already reported).

### 3.6 Who Downloaded — `BRAND` (campaign owner)

```
GET /api/v1/campaigns/:campaignId/downloads
```
Query: `page`, `perPage`.
```json
{
  "success": true,
  "data": [
    {
      "creator": { "id": "66f0cc00000000000000aa01", "fullName": "Omar K.", "profilePicture": "https://..." },
      "totalDownloads": 3,
      "lastDownloadedAt": "2026-10-25T10:06:00.000Z"
    }
  ],
  "pagination": { "page": 1, "perPage": 20, "total": 1, "totalPages": 1 }
}
```
**Errors:** `403 FORBIDDEN` (not owner), `404 NOT_FOUND`.

---

## 4. Preparing a Submission — `CLIPPER`

### Shared object: `SubmissionRequirements`
Returned with `#` / `@` prefixes for display (stored without them).
```json
{
  "platforms": ["TIKTOK"],
  "aspectRatio": "9:16",
  "durationRange": { "min": 30, "max": 60 },
  "requiredHashtags": ["#تمويل_إسلامي", "#وافي_الاستثمار"],
  "requiredKeywords": [],
  "requiredMentions": ["@WafiFinance"],
  "shariaNote": "خلو تام من المعازف",
  "offerCondition": "",
  "clipIdea": ""
}
```
`platforms: []` means all supported platforms. Any field may be empty/`null` for campaigns the brand did not configure.

### 4.1 Campaigns Ready for Delivery  ("Pick the campaign to submit")

```
GET /api/v1/submissions/eligible-campaigns
```
| Query | Notes |
|---|---|
| `tab` | `ALL` (default), `READY`, `ENDING_SOON` |
| `search` | max 100 chars, matches campaign name or brand name |
| `page`, `perPage` | default 20, max 50 |

**Definitions**
- Eligible = the caller has an `ACCEPTED` application and the campaign is not archived, cancelled, completed, expired, suspended or past `endDate`.
- `READY` = eligible **and** open for submissions (`ACTIVE`, or paused only by the daily limit, `remainingBudget > 0`) **and** active submissions < limit.
- `ENDING_SOON` = `READY` with `endDate` within `SUBMISSION_ENDING_SOON_HOURS` (default 48h).
- `ALL` also includes eligible campaigns that are temporarily unavailable (`availability: "UNAVAILABLE"`).

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "campaignId": "66f1a2b3c4d5e6f708192a3b",
      "code": "PPV-192A3B",
      "name": "Wafi Islamic Finance Platform",
      "coverImage": "https://res.cloudinary.com/.../cover.jpg",
      "brand": { "id": "66f0aa11bb22cc33dd44ee55", "name": "Wafi Finance", "logo": "https://..." },
      "isHalalVerified": true,
      "requirements": { "...": "SubmissionRequirements (see above)" },
      "endDate": "2026-10-26T08:00:00.000Z",
      "hoursLeft": 18,
      "availability": "AVAILABLE",
      "unavailableReason": null,
      "badges": ["READY", "ENDING_SOON"],
      "mySubmissions": { "active": 1, "limit": 5 }
    }
  ],
  "meta": { "counts": { "all": 3, "ready": 3, "endingSoon": 1 } },
  "pagination": { "page": 1, "perPage": 20, "total": 3, "totalPages": 1 }
}
```
`unavailableReason`: `null`, `CAMPAIGN_PAUSED`, `BUDGET_EXHAUSTED`, `SUBMISSION_LIMIT_REACHED`. `hoursLeft` is `null` when the campaign has no `endDate`. `code` is derived from the campaign id (display only).

> The design shows three different "verified" badge texts per brand. There is no data behind them; the API returns a single `isHalalVerified` (always `true` for visible campaigns, as in Sprint 4).

**Empty state:** `data: []` → "No campaigns ready for delivery".

### 4.2 Submission Requirements for One Campaign  ("Campaign terms" button / form header)

```
GET /api/v1/campaigns/:campaignId/submission-requirements
```
**Response 200**
```json
{
  "success": true,
  "data": {
    "campaignId": "66f1a2b3c4d5e6f708192a3b",
    "name": "Wafi Islamic Finance Platform",
    "requirements": { "...": "SubmissionRequirements" },
    "brief": { "mainIdea": "...", "tone": "...", "keyMessages": "...", "keywords": ["..."], "visualReferences": "" },
    "endDate": "2026-10-26T08:00:00.000Z",
    "mySubmissions": { "active": 1, "limit": 5 },
    "canSubmit": true,
    "cannotSubmitReason": null
  }
}
```
`cannotSubmitReason`: `null`, `CAMPAIGN_UNAVAILABLE`, `SUBMISSION_LIMIT_REACHED`.
**Errors:** `403 APPLICATION_NOT_ACCEPTED`, `404 NOT_FOUND`.

### 4.3 Check a Link  ("Check link" button)

Does **not** create anything. Parses and normalizes the link, fetches the post data, and evaluates the campaign requirements.

```
POST /api/v1/submissions/verify-link
```
Rate limited per user.
```json
{
  "campaignId": "66f1a2b3c4d5e6f708192a3b",
  "platform": "TIKTOK",
  "url": "https://www.tiktok.com/@mizaninvest/video/7391234567890123456"
}
```
| Field | Type | Required | Rules |
|---|---|---|---|
| `campaignId` | ObjectId | Yes | caller must be accepted into it |
| `platform` | String | Yes | `TIKTOK` / `INSTAGRAM` / `YOUTUBE` |
| `url` | String | Yes | max 500 chars, `https` |

**Response 200**
```json
{
  "success": true,
  "data": {
    "platform": "TIKTOK",
    "canonicalUrl": "https://www.tiktok.com/@mizaninvest/video/7391234567890123456",
    "externalId": "7391234567890123456",
    "fetchStatus": "OK",
    "preview": {
      "thumbnailUrl": "https://...",
      "caption": "كيف تبدأ استثمارك ... #وافي_الاستثمار",
      "authorName": "Mizan Invest",
      "authorHandle": "@MizanInvest",
      "authorUrl": "https://www.tiktok.com/@mizaninvest",
      "durationSec": 42,
      "stats": null
    },
    "requirements": {
      "hashtags":  [ { "tag": "#تمويل_إسلامي", "found": false }, { "tag": "#وافي_الاستثمار", "found": true } ],
      "keywords":  [],
      "mentions":  [ { "mention": "@WafiFinance", "found": true } ],
      "duration":  { "ok": true, "actualSec": 42, "min": 30, "max": 60 },
      "allMet": false
    },
    "canSubmit": false,
    "warnings": []
  }
}
```
- `found: null` (instead of true/false) when the post text could not be read (`fetchStatus: "UNAVAILABLE"`); then `canSubmit` stays `true` and `warnings` contains `"CONTENT_NOT_VERIFIABLE"` (the AI / manual review decides).
- `stats` is `null` unless the platform exposes it (A6). `duration.ok` is `null` when unknown.
- The Facebook/other-platform and invalid-link screens are **errors**, below.

**Errors**
```json
{ "success": false, "message": "Unsupported platform", "code": "UNSUPPORTED_PLATFORM" }
{ "success": false, "message": "Link does not match the selected platform", "code": "PLATFORM_MISMATCH", "details": { "detected": "YOUTUBE" } }
{ "success": false, "message": "Invalid link", "code": "INVALID_LINK", "details": { "httpStatus": 404 } }
{ "success": false, "message": "This post is not public", "code": "POST_NOT_PUBLIC" }
{
  "success": false, "message": "This link has already been submitted", "code": "LINK_ALREADY_SUBMITTED",
  "details": { "submissionId": "...", "code": "SUB-2026-A3F9C2", "campaignName": "Wafi...", "submittedAt": "...", "status": "APPROVED" }
}
```
`details` of `LINK_ALREADY_SUBMITTED` is `null` when the existing submission belongs to **another** creator (privacy).
Also: `403 APPLICATION_NOT_ACCEPTED`, `404 NOT_FOUND` (campaign), `409 CAMPAIGN_UNAVAILABLE`, `409 SUBMISSION_LIMIT_REACHED`, `429 TOO_MANY_REQUESTS`.

Accepted URL shapes (MVP):
| Platform | Examples |
|---|---|
| TikTok | `tiktok.com/@user/video/<id>`, `vm.tiktok.com/<code>`, `vt.tiktok.com/<code>`, `tiktok.com/t/<code>` |
| Instagram | `instagram.com/reel/<code>`, `instagram.com/reels/<code>` |
| YouTube | `youtube.com/shorts/<id>` only |

### 4.4 Draft ("Save for later")

One draft per creator per campaign, auto-deleted after 30 days. Nothing is validated except lengths.

```
GET    /api/v1/campaigns/:campaignId/submission-draft
PUT    /api/v1/campaigns/:campaignId/submission-draft
DELETE /api/v1/campaigns/:campaignId/submission-draft
```
**PUT body** (all optional, replaces the draft)
```json
{ "platform": "TIKTOK", "url": "https://www.tiktok.com/...", "notes": "text", "halalPledge": true }
```
**Response 200** (GET / PUT) — `data: null` on GET when there is no draft
```json
{
  "success": true,
  "data": {
    "campaignId": "66f1a2b3c4d5e6f708192a3b",
    "platform": "TIKTOK",
    "url": "https://www.tiktok.com/...",
    "notes": "text",
    "halalPledge": true,
    "updatedAt": "2026-10-24T09:00:00.000Z",
    "expiresAt": "2026-11-23T09:00:00.000Z"
  }
}
```
DELETE → `{ "success": true, "data": { "deleted": true } }`.
**Errors:** `400 VALIDATION_ERROR`, `403 APPLICATION_NOT_ACCEPTED`, `404 NOT_FOUND`.

---

## 5. Submissions — `CLIPPER`

### Shared object: `SubmissionListItem`
```json
{
  "id": "66f2a0000000000000000001",
  "code": "SUB-2026-A3F9C2",
  "campaign": {
    "id": "66f1a2b3c4d5e6f708192a3b",
    "name": "Wafi Islamic Finance Platform",
    "brand": { "id": "...", "name": "Wafi Finance", "logo": "https://..." }
  },
  "platform": "TIKTOK",
  "postUrl": "https://www.tiktok.com/@mizaninvest/video/7391234567890123456",
  "displayStatus": "AWAITING_ADVERTISER",
  "status": "UNDER_REVIEW",
  "aiScore": 96,
  "attempt": 1,
  "submittedAt": "2026-10-24T09:00:00.000Z",
  "reviewDeadlineAt": "2026-10-25T09:00:00.000Z"
}
```

### Shared object: `SubmissionDetail` (= `SubmissionListItem` + the fields below)
```json
{
  "canonicalUrl": "https://www.tiktok.com/@mizaninvest/video/7391234567890123456",
  "preview": { "thumbnailUrl": "...", "caption": "...", "authorName": "...", "authorHandle": "@MizanInvest", "authorUrl": "...", "durationSec": 42, "stats": null, "fetchStatus": "OK" },
  "hashtags": ["#تمويل_إسلامي"],
  "keywords": [],
  "notes": "تم المونتاج بالكامل بدون معازف.",
  "checks": [
    { "code": "VIDEO_FORMAT", "source": "AI", "status": "PASSED", "message": "Vertical 9:16, 1080p, 42s", "fixHint": "", "score": 100, "meta": null },
    { "code": "AUDIO_COMPLIANCE", "source": "AI", "status": "FAILED", "message": "Background music detected", "fixHint": "Replace the audio with a clean track", "score": 20, "meta": null },
    { "code": "REQUIRED_HASHTAGS", "source": "RULES", "status": "PASSED", "message": "", "fixHint": "", "score": null, "meta": { "found": ["#تمويل_إسلامي"], "missing": [] } }
  ],
  "summary": { "total": 5, "passed": 3, "failed": 2, "needsReview": 0 },
  "rejectionReasons": [ { "code": "AUDIO_COMPLIANCE", "message": "Background music detected" } ],
  "rejectedBy": null,
  "reviewNote": null,
  "steps": [
    { "key": "SUBMITTED", "state": "DONE" },
    { "key": "AI_REVIEW", "state": "DONE", "outcome": "PASSED" },
    { "key": "REWARD",    "state": "PENDING" }
  ],
  "manualReview": null,
  "canWithdraw": true,
  "canUpdateLink": true,
  "canResubmit": false,
  "resubmissionOf": null,
  "reward": null,
  "reviewedAt": null
}
```
| Field | Notes |
|---|---|
| `steps[].state` | `DONE`, `ACTIVE`, `FAILED`, `PENDING` |
| `steps[AI_REVIEW].outcome` | `PASSED`, `FAILED`, `MANUAL`, `null` (still running) |
| `manualReview` | `null`, or `{ "expectedHours": { "min": 4, "max": 8 }, "reasonCode": "AUDIO_UNCERTAIN" }` while `displayStatus = MANUAL_REVIEW` |
| `reviewNote` | The advertiser's / admin's note when `displayStatus = REJECTED` |
| `reviewDeadlineAt` | Drives the "auto-approval within 23h 14m" countdown; `null` when not applicable |
| `canWithdraw` | `status = SUBMITTED`, or `UNDER_REVIEW` before the advertiser decided |
| `canUpdateLink` | `AWAITING_ADVERTISER` or `APPROVED` (R2.12) |
| `canResubmit` | `AI_REJECTED` or `REJECTED` |
| `reward` | Always `null` in Sprint 5 (A5) |

### 5.1 Submit Content

```
POST /api/v1/campaigns/:campaignId/submissions
```
```json
{
  "platform": "TIKTOK",
  "url": "https://www.tiktok.com/@mizaninvest/video/7391234567890123456",
  "hashtags": ["#تمويل_إسلامي", "#وافي_الاستثمار"],
  "keywords": [],
  "notes": "تم المونتاج بالكامل بدون معازف.",
  "halalPledge": true
}
```
| Field | Type | Required | Rules |
|---|---|---|---|
| `platform` | String | Yes | enum |
| `url` | String | Yes | max 500, `https` |
| `hashtags` | String[] | No | max 30; the server also detects hashtags from the post |
| `keywords` | String[] | No | max 30 (R2.11) |
| `notes` | String | No | max 500 |
| `halalPledge` | Boolean | Yes | must be `true` |

**Server steps:** auth + accepted application → campaign open → active-limit check → parse/normalize link → fetch post data → evaluate requirements → duplicate check (unique index; race-safe) → create submission (`SUBMITTED`, `reviewDeadlineAt = now + deadline`) → **respond immediately** → AI review runs asynchronously → draft for this campaign is deleted.

**Response 201** — `SubmissionDetail` with `displayStatus: "PROCESSING"`:
```json
{
  "success": true,
  "data": { "id": "66f2a0000000000000000001", "code": "SUB-2026-A3F9C2", "displayStatus": "PROCESSING", "status": "SUBMITTED", "...": "SubmissionDetail" }
}
```
The frontend then polls §5.3 every 3–5 seconds (max ~2 minutes) until `displayStatus` leaves `PROCESSING`; later changes arrive through notifications.

**Errors**
```json
{
  "success": false, "message": "Content does not meet campaign requirements", "code": "CONTENT_REQUIREMENTS_NOT_MET",
  "details": { "missingHashtags": ["#تمويل_إسلامي"], "missingKeywords": [], "missingMentions": [], "duration": null }
}
```
Plus every error of §4.3, `400 VALIDATION_ERROR` (`halalPledge` must be true), `409 SUBMISSION_LIMIT_REACHED`.

### 5.2 My Submissions

```
GET /api/v1/submissions/my
```
| Query | Values |
|---|---|
| `displayStatus` | any `displayStatus`. Default: all **except** `WITHDRAWN` |
| `campaignId` | filter by campaign |
| `page`, `perPage` | pagination |

**Response 200** — array of `SubmissionListItem` + standard `pagination`.
Empty state: `data: []` → "You have not submitted any clips yet".

### 5.3 Submission Details

```
GET /api/v1/submissions/:id
```
**Response 200** — `SubmissionDetail`. `404 NOT_FOUND` also for another creator's submission.

### 5.4 Withdraw  ("Withdraw to edit")

```
DELETE /api/v1/submissions/:id
```
Allowed while `canWithdraw` is true. Releases the link (it can be submitted again after editing the post).
```json
{ "success": true, "data": { "id": "66f2a0000000000000000001", "status": "WITHDRAWN" } }
```
**Errors:** `404 NOT_FOUND`, `409 SUBMISSION_NOT_WITHDRAWABLE`.

### 5.5 Update the Link  (R2.12 — repost / edit)

```
PUT /api/v1/submissions/:id/link
```
```json
{ "url": "https://www.tiktok.com/@mizaninvest/video/7399999999999999999", "reason": "Reposted with a new caption" }
```
Re-parses and re-verifies the new link (same rules and errors as §5.1). The old link is appended to `linkHistory`, the submission returns to `SUBMITTED` and goes through AI review again. If it was `APPROVED`, advertiser approval is reset as well.

**Response 200** — `SubmissionDetail`.
**Errors:** every error of §4.3, `404 NOT_FOUND`, `409 SUBMISSION_NOT_EDITABLE`.

### 5.6 Resubmit after Rejection

```
POST /api/v1/submissions/:id/resubmit
```
Optional body: `{ "url": "...", "notes": "...", "hashtags": [], "keywords": [] }`. Omitted fields are copied from the previous attempt. Creates a **new** submission (`attempt + 1`, `resubmissionOf = :id`) after re-verifying the link; runs through the same steps and errors as §5.1.

**Response 201** — `SubmissionDetail` (`displayStatus: "PROCESSING"`).
**Errors:** `404 NOT_FOUND`, `409 SUBMISSION_NOT_EDITABLE` (source is not rejected), plus errors of §5.1.

---

## 6. Review — provisional (needed to complete the flow)

### 6.1 Campaign Submissions — `BRAND` (campaign owner)

```
GET /api/v1/campaigns/:campaignId/submissions
```
| Query | Values |
|---|---|
| `displayStatus` | default `AWAITING_ADVERTISER`; or any status, or `ALL` |
| `page`, `perPage` | pagination |

Items = `SubmissionListItem` + `creator: { id, fullName, profilePicture, country, city }`, `preview`, `checks`, `summary`, `aiScore`.
Submissions in `PROCESSING` and `MANUAL_REVIEW` are **not** shown to the brand.
**Errors:** `403 FORBIDDEN`, `404 NOT_FOUND`.

### 6.2 Approve / Reject — `BRAND` (campaign owner)

```
PUT /api/v1/submissions/:id/review
```
```json
{ "decision": "APPROVE", "note": "optional" }
```
`decision`: `APPROVE` or `REJECT` (`note` required for `REJECT`, max 1000).
Effects: `APPROVE` → `status = APPROVED`, increments `campaign.stats.totalApprovedVideos`. `REJECT` → `status = REJECTED`, `rejectedBy = ADVERTISER`, link released. Creator notified. Allowed only while `displayStatus = AWAITING_ADVERTISER`.

**Response 200**
```json
{ "success": true, "data": { "id": "...", "status": "APPROVED", "displayStatus": "APPROVED", "reviewedAt": "2026-10-24T11:00:00.000Z" } }
```
**Errors:** `403 FORBIDDEN`, `404 NOT_FOUND`, `409 SUBMISSION_ALREADY_REVIEWED`, `409 CAMPAIGN_SUSPENDED`, `400 VALIDATION_ERROR`.

### 6.3 Manual Review Queue — `ADMIN`

```
GET /api/v1/admin/submissions/manual-review
```
Query: `page`, `perPage`. Oldest first. Returns `SubmissionListItem` + `creator`, `preview`, `checks`, `manualReview: { reasonCode, queuedAt }`.

### 6.4 Decide a Manual Review — `ADMIN`

```
PUT /api/v1/admin/submissions/:id/review
```
```json
{ "decision": "APPROVE", "note": "audio is clean" }
```
`APPROVE` → moves to the advertiser stage (`AWAITING_ADVERTISER`, deadline reset). `REJECT` → `REJECTED`, `rejectedBy = ADMIN`, `note` required.
**Errors:** `404 NOT_FOUND`, `409 SUBMISSION_ALREADY_REVIEWED`.

---

## 7. Notifications (new types)

Same pull-based mechanism as Sprint 4 §6. `title`/`message` are English fallbacks; the frontend translates by `type` + `data`.

| `type` | Recipient | `data` | Email? |
|---|---|---|---|
| `NEW_SUBMISSION` | Advertiser | `campaignId`, `submissionId` | Yes |
| `SUBMISSION_AI_APPROVED` | Creator | `campaignId`, `submissionId` | No |
| `SUBMISSION_AI_REJECTED` | Creator | `campaignId`, `submissionId` | Yes |
| `SUBMISSION_MANUAL_REVIEW` | Creator | `campaignId`, `submissionId` | No |
| `MANUAL_REVIEW_REQUIRED` | All admins | `submissionId`, `campaignId`, `reasonCode` | One email to the moderation address |
| `SUBMISSION_APPROVED` | Creator | `campaignId`, `submissionId`, `auto` (bool) | Yes |
| `SUBMISSION_REJECTED` | Creator | `campaignId`, `submissionId` | Yes |
| `DOWNLOAD_COMPLETED` | Creator | `campaignId`, `logId` | No |
| `DOWNLOAD_FAILED` | Creator | `campaignId`, `logId` | No |

`NEW_SUBMISSION` is sent when the submission **reaches the advertiser stage** (after AI approval, or after admin approval of a manual review), not at the moment of submission.

---

## 8. Background Jobs (internal)

All jobs are **idempotent** and also run a catch-up pass at server start (the Render free instance sleeps; timers do not fire while asleep).

| Job | Schedule | Logic |
|---|---|---|
| `submissionProcessor` | every 2 min + once at startup | Picks `SUBMITTED` submissions with `aiReview.status = PENDING` whose lock is empty/older than 5 min. Locks, calls the AI service, applies the result with a conditional update (`status` still `SUBMITTED`). After 3 failed attempts → `MANUAL_REVIEW_REQUIRED` with `reasonCode = AI_UNAVAILABLE` (SRS fallback) |
| `submissionAutoApprove` | every 10 min + once at startup | `UNDER_REVIEW` at advertiser stage with `advertiserReview.status = PENDING` and `reviewDeadlineAt <= now` → `APPROVED`, `advertiserReview.status = AUTO_APPROVED`. Disabled when `ENABLE_SUBMISSION_AUTO_APPROVE=false` |

---

## 9. AI Service Contract (proposal — to agree with the AI engineer)

Service-to-service call authenticated with `X-Service-Key: <AI_SERVICE_API_KEY>`. Timeout `AI_REVIEW_TIMEOUT_MS` (default 90s; the AI service may cold-start).

```
POST {AI_SERVICE_URL}/api/v1/ai/submissions/review
```
**Request**
```json
{
  "submissionId": "66f2a0000000000000000001",
  "platform": "TIKTOK",
  "postUrl": "https://www.tiktok.com/@mizaninvest/video/7391234567890123456",
  "post": {
    "caption": "كيف تبدأ استثمارك ... #وافي_الاستثمار",
    "hashtags": ["وافي_الاستثمار"],
    "mentions": ["WafiFinance"],
    "authorHandle": "@MizanInvest",
    "durationSec": 42,
    "thumbnailUrl": "https://...",
    "fetchStatus": "OK"
  },
  "campaign": {
    "name": "Wafi Islamic Finance Platform",
    "brief": { "mainIdea": "...", "tone": "...", "keyMessages": "...", "keywords": ["..."] },
    "requirements": {
      "requiredHashtags": ["تمويل_إسلامي", "وافي_الاستثمار"],
      "requiredKeywords": [],
      "requiredMentions": ["WafiFinance"],
      "aspectRatio": "9:16",
      "minDurationSec": 30,
      "maxDurationSec": 60,
      "shariaNote": "خلو تام من المعازف"
    },
    "halalDeclaration": { "noGambling": true, "noSexualContent": true, "noExplicitMusic": true, "noAlcohol": true, "noSuspiciousCurrencies": true, "noUnrealisticProfit": true }
  },
  "backendChecks": [
    { "code": "REQUIRED_HASHTAGS", "status": "PASSED" }
  ]
}
```
**Response 200**
```json
{
  "result": "APPROVED",
  "score": 96,
  "feedback": "Clip meets all requirements",
  "checks": [
    { "code": "AUDIO_COMPLIANCE", "status": "PASSED", "message": "No music or instruments detected", "fixHint": "", "score": 100 },
    { "code": "LOGO_VISIBLE", "status": "PASSED", "message": "Logo visible at the start", "fixHint": "", "score": 95 }
  ],
  "manualReasonCode": null
}
```
| Field | Rules |
|---|---|
| `result` | `APPROVED`, `REJECTED`, `MANUAL_REVIEW_REQUIRED` |
| `score` | 0–100 |
| `checks[].status` | `PASSED`, `FAILED`, `NEEDS_REVIEW`, `SKIPPED` |
| `manualReasonCode` | required when `result = MANUAL_REVIEW_REQUIRED` (e.g. `AUDIO_UNCERTAIN`) |

On `REJECTED`, every `FAILED` check becomes a `rejectionReasons` entry, so each must carry a clear `message` and `fixHint`. Any non-2xx / timeout / schema mismatch counts as a failed attempt (see §8).

---

## 10. Changes to Existing Endpoints & Behaviour

| Area | Change |
|---|---|
| `GET /applications/:id/materials` (Sprint 4 §4.4) | **Breaking:** `downloadUrl` removed; now requires `ACCEPTED` (the check was disabled in code); see §3.1 |
| `POST /campaigns`, `POST /campaigns/drafts`, `PUT /campaigns/drafts/:draftId` | New optional fields: `submissionRequirements` (`platforms`, `requiredHashtags`, `requiredKeywords`, `requiredMentions`, `aspectRatio`, `minDurationSec`, `maxDurationSec`, `shariaNote`, `offerCondition`, `clipIdea`) and `maxSubmissionsPerCreator` |
| `GET /campaigns`, `GET /campaigns/:campaignId` (advertiser) | Include `submissionRequirements` and `maxSubmissionsPerCreator` |
| Campaign activity log | New actions: `MATERIALS_DOWNLOADED`, `SUBMISSION_RECEIVED`, `SUBMISSION_APPROVED`, `SUBMISSION_REJECTED` |
| Error envelope | Optional `details` object |

---

## 11. Known Limitations (MVP)

- **Downloads:** link signing is app-level. Files remain publicly reachable on Cloudinary by anyone who has the raw URL. Moving to Cloudinary `authenticated` delivery is planned as a hardening task (needs migrating existing files and every place that reads `fileUrl`).
- **No ZIP:** "Download all" returns one link per file. A single archive link (`strategy: "ARCHIVE"`) is deferred. Progress is per file.
- **Campaign brief PDF** ("Download PDF" button) is deferred (Arabic text rendering in PDFs needs font shaping work).
- **Post statistics** (likes/comments/shares/views) are available only for YouTube; **Instagram** content is not verifiable server-side (A6, A7). TikTok data comes from its public oEmbed (caption, author, thumbnail).
- **Brand-side screens** for `submissionRequirements` are not designed yet; until the brand sets them there are no blocking hashtag rules (A9).
- **Rewards** and creator earnings are out of scope (A5).
- **Support/community messaging** shown in the notifications drawer of the downloads design is not part of this sprint.
- The sample numbers in the designs (14 files, 3.8 GB) exceed the real upload limits (max 10 files, 20 MB each).

---

## 12. Endpoint Summary

| # | Method | Endpoint | Role | Description |
|---|---|---|---|---|
| 1 | GET | `/applications/:id/materials` | Creator | List materials (changed) |
| 2 | POST | `/applications/:id/materials/:materialId/download-link` | Creator | Single-use link for one file |
| 3 | POST | `/applications/:id/materials/download-all` | Creator | Links for all files |
| 4 | GET | `/materials/download/:token` | Token | Redeem link (302) |
| 5 | PATCH | `/downloads/:logId` | Creator | Report download result |
| 6 | GET | `/campaigns/:campaignId/downloads` | Brand | Who downloaded |
| 7 | GET | `/submissions/eligible-campaigns` | Creator | Campaigns ready for delivery |
| 8 | GET | `/campaigns/:campaignId/submission-requirements` | Creator | Requirements + terms |
| 9 | POST | `/submissions/verify-link` | Creator | Check a link |
| 10 | GET | `/campaigns/:campaignId/submission-draft` | Creator | Get draft |
| 11 | PUT | `/campaigns/:campaignId/submission-draft` | Creator | Save draft |
| 12 | DELETE | `/campaigns/:campaignId/submission-draft` | Creator | Delete draft |
| 13 | POST | `/campaigns/:campaignId/submissions` | Creator | Submit content |
| 14 | GET | `/submissions/my` | Creator | My submissions |
| 15 | GET | `/submissions/:id` | Creator | Submission details |
| 16 | DELETE | `/submissions/:id` | Creator | Withdraw |
| 17 | PUT | `/submissions/:id/link` | Creator | Update link |
| 18 | POST | `/submissions/:id/resubmit` | Creator | Resubmit after rejection |
| 19 | GET | `/campaigns/:campaignId/submissions` | Brand | Campaign submissions |
| 20 | PUT | `/submissions/:id/review` | Brand | Approve / reject |
| 21 | GET | `/admin/submissions/manual-review` | Admin | Manual review queue |
| 22 | PUT | `/admin/submissions/:id/review` | Admin | Decide manual review |

---

## 13. Notes for Backend Developers

1. **Route order.** Mount the new routers in `app.js` **before** `campaignBudgetRoutes`. In `submission.routes.js` register `/submissions/eligible-campaigns`, `/submissions/verify-link` and `/submissions/my` **before** `/submissions/:id`. Routers that span several prefixes (`material`, `submission`) are mounted on `/api/v1` with full paths and apply middleware per route (no router-level `router.use(protect, ...)`).
2. **No notification inside a transaction** — send after the commit (same rule as Sprint 4). The AI call is never made inside a transaction.
3. **Updating a submission with `updateOne` / `findOneAndUpdate`** skips the model's `pre('validate')` hook: set `linkLocked` explicitly (`false` on REJECTED / WITHDRAWN).
4. **Link normalization / SSRF.** Only follow redirects for short-link hosts on an allowlist (`vm.tiktok.com`, `vt.tiktok.com`, `tiktok.com/t/`). Never fetch an arbitrary user URL.
5. **Hashtag matching** is case-insensitive and ignores Arabic diacritics and `_` / space differences (`hashtag.utils.js`).