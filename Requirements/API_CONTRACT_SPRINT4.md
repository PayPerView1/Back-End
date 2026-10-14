# API Contract — Sprint 4: Campaign Discovery & Application (Content Creator)

> **Version:** MVP
> **Base URL:** `/api/v1`
> **Authentication:** `Authorization: Bearer <JWT>` unless marked `[PUBLIC]` or `[OPTIONAL]`
> **Roles:** `CLIPPER` (content creator), `BRAND` (advertiser), `ADMIN`
> **Response format:** same envelope as Sprint 3 — `{ success: true/false, ... }`
> **IDs:** MongoDB ObjectId strings (24 hex chars) — **not** UUIDs
> **Country codes:** ISO 3166-1 **alpha-3** (`SAU`, `EGY`, `ARE`) in every campaign-related field, filter and preference
> **Dates:** ISO 8601 UTC strings
> **Currency:** USD

---

## Response Envelope

### Success
```json
{ "success": true, "data": { } }
```

### Success with extra info
```json
{ "success": true, "data": [ ], "meta": { } }
```

### Error
```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "ERROR_CODE"
}
```
Validation errors (`400 VALIDATION_ERROR`) may also include a field-level list:
```json
{
  "success": false,
  "message": "Reason is required",
  "code": "VALIDATION_ERROR",
  "errors": [ { "field": "reason", "message": "Reason is required" } ]
}
```
> 500 errors always return `"message": "Server error"`.

### Paginated (same shape as Sprint 3)
```json
{
  "success": true,
  "data": [ ],
  "pagination": { "page": 1, "perPage": 20, "total": 45, "totalPages": 3 }
}
```
Query params for every paginated endpoint: `page` (default 1), `perPage` (default 20, max 50).

---

## Error Codes (new in Sprint 4)

| Code | HTTP | Meaning |
|---|---|---|
| `CAMPAIGN_UNAVAILABLE` | 409 | Campaign cannot be applied to / used right now (budget exhausted, paused, ended, under review, cancelled). The reason is intentionally not revealed |
| `CAMPAIGN_SUSPENDED` | 409 | Advertiser action blocked because the campaign is under review after a report |
| `ALREADY_APPLIED` | 409 | Creator already has a PENDING / ACCEPTED / REJECTED application for this campaign |
| `APPLICANT_LIMIT_REACHED` | 409 | Campaign reached `maxApplicants` |
| `REQUIREMENTS_NOT_MET` | 403 | Creator does not meet the campaign requirements (**not enforced yet**, see Known Limitations) |
| `APPLICATION_NOT_WITHDRAWABLE` | 409 | Application is no longer PENDING |
| `APPLICATION_ALREADY_REVIEWED` | 409 | Application is no longer PENDING (advertiser decision) |
| `ALREADY_REPORTED` | 409 | Same user/email already reported this campaign |
| `CANNOT_REPORT_OWN_CAMPAIGN` | 403 | Advertiser tried to report their own campaign |
| `REPORT_ALREADY_REVIEWED` | 409 | Report already resolved or dismissed |
| `INVALID_TOKEN` | 400 | Report confirmation token invalid, expired or already used |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |

Existing codes (`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INSUFFICIENT_BALANCE`, `INTERNAL_ERROR`, ...) keep the Sprint 3 meaning.

---

## 1. Discover Campaigns — `CLIPPER`

### 1.1 List / Search / Filter / Sort

```
GET /api/v1/campaigns/discover
```

| Query param | Type | Notes |
|---|---|---|
| `search` | String | Max 100 chars. Matches campaign name **or** brand name (case-insensitive, partial) |
| `contentType` | String | `CLIPPING`, `UGC`, `SLIDESHOW`, `AUDIO`, `LOGO`, `MIXED`. Also returns `MIXED` campaigns whose `subCategories` include it |
| `countries` | String | Comma-separated alpha-3 list, e.g. `SAU,EGY`. Returns campaigns targeting **any** of them |
| `minCpm` / `maxCpm` | Number | CPM range (USD) |
| `sort` | String | `newest` (default), `highestCpm`, `endingSoon`, `bestMatch` |
| `page`, `perPage` | Number | See pagination |

**Which campaigns are returned**
- `ACTIVE` campaigns → `availability: "AVAILABLE"`
- Campaigns paused because the daily limit was reached → `AVAILABLE` (they resume at 00:00 UTC)
- Campaigns whose budget is exhausted → `availability: "UNAVAILABLE"` (cannot apply)
- **Never returned:** campaigns under review after a report, manually paused, ended, archived, cancelled, or not yet approved

`endingSoon` returns campaigns with the nearest `endDate` first; campaigns without an `endDate` come last.
`bestMatch` uses the creator's saved preferences (see section 2); without preferences it behaves like `newest`.

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "66f1a2b3c4d5e6f708192a3b",
      "name": "Ramadan Collection Launch",
      "brand": { "id": "66f0aa11bb22cc33dd44ee55", "name": "Noor Store", "logo": "https://res.cloudinary.com/.../logo.png" },
      "contentType": "CLIPPING",
      "subCategories": [],
      "cpm": 1.5,
      "remainingBudget": 820.0,
      "targetCountries": ["SAU", "ARE"],
      "isHalalVerified": true,
      "availability": "AVAILABLE",
      "unavailableReason": null,
      "endDate": "2026-11-30T20:59:59.000Z",
      "isFavorited": false,
      "applicationStatus": null,
      "createdAt": "2026-10-01T08:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "perPage": 20, "total": 1, "totalPages": 1 }
}
```

| Field | Notes |
|---|---|
| `brand.logo` | The advertiser's `profilePicture` value as stored |
| `isHalalVerified` | Always `true` for campaigns returned here (every visible campaign passed the Halal declaration + review) |
| `availability` | `AVAILABLE` or `UNAVAILABLE` |
| `unavailableReason` | `null` or `BUDGET_EXHAUSTED` |
| `isFavorited` | For the logged-in creator (heart icon state) |
| `applicationStatus` | `null`, `PENDING`, `ACCEPTED`, `REJECTED` (`WITHDRAWN` is returned as `null`) |

**Empty state:** `data: []` with `total: 0` → show "No campaigns currently available. Check back later."

**Errors**
```json
{ "success": false, "message": "...", "code": "VALIDATION_ERROR" }
{ "success": false, "message": "Only content creator accounts can perform this action", "code": "FORBIDDEN" }
```

---

### 1.2 Search Suggestions

```
GET /api/v1/campaigns/discover/suggestions?q=nou
```
`q`: 2–50 chars. Returns up to 8 suggestions (campaign names first, then brand names).

**Response 200**
```json
{
  "success": true,
  "data": [
    { "type": "CAMPAIGN", "id": "66f1a2b3c4d5e6f708192a3b", "label": "Noor Ramadan Launch" },
    { "type": "BRAND", "id": "66f0aa11bb22cc33dd44ee55", "label": "Noor Store" }
  ]
}
```

---

### 1.3 Campaign Details

```
GET /api/v1/campaigns/:campaignId/details
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": "66f1a2b3c4d5e6f708192a3b",
    "name": "Ramadan Collection Launch",
    "brand": { "id": "66f0aa11bb22cc33dd44ee55", "name": "Noor Store", "logo": "https://..." },
    "contentType": "CLIPPING",
    "subCategories": [],
    "cpm": 1.5,
    "remainingBudget": 820.0,
    "targetCountries": ["SAU", "ARE"],
    "isHalalVerified": true,
    "availability": "AVAILABLE",
    "unavailableReason": null,
    "startDate": null,
    "endDate": "2026-11-30T20:59:59.000Z",
    "brief": {
      "mainIdea": "Short clips of the new collection",
      "tone": "Warm and festive",
      "keyMessages": "Quality, family, Ramadan",
      "keywords": ["ramadan", "collection"],
      "visualReferences": ""
    },
    "materials": [
      {
        "id": "66f1a2b3c4d5e6f708192a40",
        "fileName": "intro.mp4",
        "fileType": "VIDEO",
        "mimeType": "video/mp4",
        "fileSizeKb": 8200,
        "previewUrl": "https://res.cloudinary.com/.../w_480,q_auto:low/.../intro.mp4"
      }
    ],
    "canDownloadMaterials": false,
    "maxApplicants": 50,
    "applicantsCount": 12,
    "requirements": { "minFollowers": null, "minRating": null },
    "application": null,
    "isFavorited": false,
    "favoriteId": null,
    "canApply": true,
    "applyBlockedReason": null
  }
}
```

| Field | Notes |
|---|---|
| `materials[].previewUrl` | View-only, reduced quality (and trimmed/watermarked where applicable). The original file URL is **never** returned here. Files of type `AUDIO`/`OTHER` may have `previewUrl: null` (show name/size only) |
| `canDownloadMaterials` | `true` only if the creator's application is `ACCEPTED`. Then use `GET /applications/:id/materials` |
| `application` | `null` or `{ "id": "...", "status": "PENDING" }` |
| `canApply` | Use it to enable/disable the "Apply Now" button |
| `applyBlockedReason` | `null`, `ALREADY_APPLIED`, `CAMPAIGN_UNAVAILABLE`, `APPLICANT_LIMIT_REACHED`, `REQUIREMENTS_NOT_MET` |
| `maxApplicants` | `null` = unlimited |

**Errors**
```json
{ "success": false, "message": "Campaign not found", "code": "NOT_FOUND" }
```
`404` is also returned for campaigns that are not visible to creators (e.g. under review after a report) — their existence is not revealed.

---

## 2. Recommendations & Preferences — `CLIPPER`

### 2.1 Recommended Campaigns

```
GET /api/v1/campaigns/recommendations?limit=10
```
`limit`: 1–20, default 10. Results are computed on each request, so they always reflect the latest preferences and application history.

Scoring signals (MVP): country match with `preferredCountries`, content type match with `preferredContentTypes` or with content types of the creator's previous accepted/pending applications, and `cpm >= minCpm`. Campaigns the creator already applied to are excluded.

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "66f1a2b3c4d5e6f708192a3b",
      "name": "Ramadan Collection Launch",
      "brand": { "id": "...", "name": "Noor Store", "logo": "https://..." },
      "contentType": "CLIPPING",
      "cpm": 1.5,
      "remainingBudget": 820.0,
      "targetCountries": ["SAU", "ARE"],
      "isHalalVerified": true,
      "availability": "AVAILABLE",
      "isFavorited": false,
      "matchScore": 7,
      "reasons": [
        { "code": "COUNTRY_MATCH", "value": "SAU" },
        { "code": "CONTENT_TYPE_MATCH", "value": "CLIPPING" }
      ]
    }
  ],
  "meta": { "hasPreferences": true }
}
```

| `reasons[].code` | `value` | Suggested text |
|---|---|---|
| `COUNTRY_MATCH` | alpha-3 code | "Because your audience is in Saudi Arabia" |
| `CONTENT_TYPE_MATCH` | content type | "Because you produce clipping content" |
| `CPM_MATCH` | the campaign CPM | "Meets your minimum CPM" |
| `PREVIOUS_PARTICIPATION` | content type | "Similar to campaigns you joined" |

`data: []` → show "No recommendations at the moment. Browse all campaigns." with a "Browse All" button. If `meta.hasPreferences` is `false`, also prompt the creator to set preferences.

---

### 2.2 Get Preferences

```
GET /api/v1/creator/preferences
```
**Response 200** (returns defaults if the creator never saved any)
```json
{
  "success": true,
  "data": {
    "preferredContentTypes": ["CLIPPING", "UGC"],
    "preferredCountries": ["SAU", "EGY"],
    "minCpm": 1.0,
    "updatedAt": "2026-10-12T10:00:00.000Z"
  }
}
```

### 2.3 Update Preferences

Replaces the saved preferences (send the full set). Recommendations recalculate automatically.

```
PUT /api/v1/creator/preferences
```
**Request Body**
```json
{
  "preferredContentTypes": ["CLIPPING", "UGC"],
  "preferredCountries": ["SAU", "EGY"],
  "minCpm": 1.0
}
```
| Field | Type | Required | Rules |
|---|---|---|---|
| `preferredContentTypes` | String[] | No | Values from `CONTENT_TYPE`; default `[]` |
| `preferredCountries` | String[] | No | alpha-3 codes (alpha-2 is accepted and converted); max 30; default `[]` |
| `minCpm` | Number | No | ≥ 0; default 0 |

**Response 200** — same shape as 2.2.

---

## 3. Favorites — `CLIPPER`

### 3.1 Add to Favorites

Idempotent: adding an existing favorite returns the existing record.

```
POST /api/v1/favorites
```
```json
{ "campaignId": "66f1a2b3c4d5e6f708192a3b" }
```
**Response 201** (new) / **200** (already existed)
```json
{
  "success": true,
  "data": { "id": "66f1b0000000000000000001", "campaignId": "66f1a2b3c4d5e6f708192a3b", "createdAt": "2026-10-12T10:00:00.000Z", "alreadyExisted": false }
}
```
**Errors:** `404 NOT_FOUND` (campaign not found or not visible to creators), `400 VALIDATION_ERROR`.

### 3.2 List Favorites

```
GET /api/v1/favorites
```
| Query param | Values |
|---|---|
| `sort` | `newest` (default), `oldest`, `highestCpm` |
| `availability` | `ALL` (default), `AVAILABLE`, `UNAVAILABLE` |
| `contentType` | any `CONTENT_TYPE` |
| `page`, `perPage` | pagination |

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "66f1b0000000000000000001",
      "createdAt": "2026-10-12T10:00:00.000Z",
      "campaign": {
        "id": "66f1a2b3c4d5e6f708192a3b",
        "name": "Ramadan Collection Launch",
        "brand": { "id": "...", "name": "Noor Store", "logo": "https://..." },
        "contentType": "CLIPPING",
        "cpm": 1.5,
        "remainingBudget": 820.0,
        "targetCountries": ["SAU"],
        "availability": "AVAILABLE",
        "unavailableReason": null
      }
    }
  ],
  "pagination": { "page": 1, "perPage": 20, "total": 1, "totalPages": 1 }
}
```
Favorited campaigns that are no longer visible (ended, cancelled, under review, ...) are still listed with `availability: "UNAVAILABLE"` and `unavailableReason`: `BUDGET_EXHAUSTED`, `ENDED` or `NOT_AVAILABLE`. Their `remainingBudget`/`targetCountries` may be `null`.

Empty state: `data: []` → "No campaigns in favorites. Start exploring campaigns." + "Discover Campaigns" button.

### 3.3 Remove from Favorites

```
DELETE /api/v1/favorites/:id
```
`:id` is the **favorite** id (from the list), not the campaign id.

**Response 200**
```json
{ "success": true, "data": { "id": "66f1b0000000000000000001", "removed": true } }
```
**Errors:** `404 NOT_FOUND` (also when it belongs to another user).

### 3.4 Bulk Remove

```
POST /api/v1/favorites/bulk-delete
```
```json
{ "ids": ["66f1b0000000000000000001", "66f1b0000000000000000002"] }
```
`ids`: 1–100 favorite ids. **Response 200**
```json
{ "success": true, "data": { "deleted": 2 } }
```
Ids that do not exist or belong to someone else are skipped silently.

---

## 4. Applications

### 4.1 Apply to a Campaign — `CLIPPER`

```
POST /api/v1/campaigns/:campaignId/apply
```
```json
{ "message": "I make short clips for Saudi audiences." }
```
| Field | Type | Required | Rules |
|---|---|---|---|
| `message` | String | No | Max 500 chars |

**Response 201**
```json
{
  "success": true,
  "data": {
    "id": "66f1c0000000000000000001",
    "campaignId": "66f1a2b3c4d5e6f708192a3b",
    "status": "PENDING",
    "message": "I make short clips for Saudi audiences.",
    "appliedAt": "2026-10-12T10:05:00.000Z"
  }
}
```
Re-applying after a **withdrawn** application is allowed (the same application id is reused and goes back to `PENDING`). After `REJECTED`, re-applying is blocked.

**Errors**
```json
{ "success": false, "message": "Campaign not found", "code": "NOT_FOUND" }
{ "success": false, "message": "This campaign is currently unavailable.", "code": "CAMPAIGN_UNAVAILABLE" }
{ "success": false, "message": "You have already applied for this campaign.", "code": "ALREADY_APPLIED" }
{ "success": false, "message": "Maximum number of applicants reached.", "code": "APPLICANT_LIMIT_REACHED" }
{ "success": false, "message": "You do not meet the requirements for this campaign.", "code": "REQUIREMENTS_NOT_MET" }
```

### 4.2 Withdraw Application — `CLIPPER`

Only while `PENDING`.

```
DELETE /api/v1/applications/:id
```
**Response 200**
```json
{ "success": true, "data": { "id": "66f1c0000000000000000001", "status": "WITHDRAWN" } }
```
**Errors:** `404 NOT_FOUND` (also when it belongs to another creator), `409 APPLICATION_NOT_WITHDRAWABLE`.

### 4.3 My Applications — `CLIPPER`

```
GET /api/v1/applications/my
```
| Query param | Values |
|---|---|
| `status` | `PENDING`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`. Default: all **except** `WITHDRAWN` |
| `page`, `perPage` | pagination |

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "66f1c0000000000000000001",
      "status": "PENDING",
      "message": "I make short clips for Saudi audiences.",
      "appliedAt": "2026-10-12T10:05:00.000Z",
      "reviewedAt": null,
      "campaign": {
        "id": "66f1a2b3c4d5e6f708192a3b",
        "name": "Ramadan Collection Launch",
        "brand": { "id": "...", "name": "Noor Store", "logo": "https://..." },
        "contentType": "CLIPPING",
        "cpm": 1.5,
        "availability": "AVAILABLE"
      }
    }
  ],
  "pagination": { "page": 1, "perPage": 20, "total": 1, "totalPages": 1 }
}
```

### 4.4 Download Materials (after acceptance) — `CLIPPER`

```
GET /api/v1/applications/:id/materials
```
**Response 200**
```json
{
  "success": true,
  "data": [
    { "id": "66f1a2b3c4d5e6f708192a40", "fileName": "intro.mp4", "fileType": "VIDEO", "mimeType": "video/mp4", "fileSizeKb": 8200, "downloadUrl": "https://res.cloudinary.com/.../intro.mp4" }
  ]
}
```
**Errors:** `403 FORBIDDEN` (application is not `ACCEPTED`), `404 NOT_FOUND`, `409 CAMPAIGN_UNAVAILABLE` (campaign cancelled or under review).

### 4.5 List Applicants of a Campaign — `BRAND` (campaign owner)

```
GET /api/v1/campaigns/:campaignId/applications
```
| Query param | Values |
|---|---|
| `status` | `PENDING` (default), `ACCEPTED`, `REJECTED`, `ALL` |
| `page`, `perPage` | pagination |

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "66f1c0000000000000000001",
      "status": "PENDING",
      "message": "I make short clips for Saudi audiences.",
      "appliedAt": "2026-10-12T10:05:00.000Z",
      "creator": { "id": "66f0cc00000000000000aa01", "fullName": "Omar K.", "profilePicture": "https://...", "country": "SA", "city": "Riyadh", "bio": "Clipper" }
    }
  ],
  "pagination": { "page": 1, "perPage": 20, "total": 1, "totalPages": 1 }
}
```
> `creator.country` is the profile value (ISO alpha-2, e.g. `SA`), unlike campaign countries (alpha-3).

**Errors:** `403 FORBIDDEN` (not the owner), `404 NOT_FOUND`.

### 4.6 Accept / Reject Application — `BRAND` (campaign owner)

```
PUT /api/v1/applications/:id/status
```
```json
{ "status": "ACCEPTED" }
```
`status`: `ACCEPTED` or `REJECTED`.

**Response 200**
```json
{
  "success": true,
  "data": { "id": "66f1c0000000000000000001", "status": "ACCEPTED", "reviewedAt": "2026-10-12T11:00:00.000Z" }
}
```
**Errors:** `403 FORBIDDEN` (not the owner), `404 NOT_FOUND`, `409 APPLICATION_ALREADY_REVIEWED`, `409 CAMPAIGN_UNAVAILABLE` (cannot accept on a cancelled/suspended campaign).

---

## 5. Reporting & Moderation

Report reasons (`reason`): `SEXUAL_CONTENT`, `GAMBLING`, `EXPLICIT_MUSIC`, `SUSPICIOUS_CURRENCIES`, `FALSE_CLAIMS`, `OTHER` (`details` is **required** for `OTHER`, optional otherwise, max 1000 chars).

### 5.1 Report a Campaign — `[OPTIONAL AUTH]` (any user or visitor)

```
POST /api/v1/campaigns/:campaignId/report
```
```json
{ "reason": "GAMBLING", "details": "Promotes a betting site", "email": "visitor@example.com" }
```
| Field | Type | Required | Rules |
|---|---|---|---|
| `reason` | String | Yes | One of the reasons above |
| `details` | String | Conditional | Required if `reason = OTHER` |
| `email` | String | Only for visitors | Required when no JWT is sent; ignored when logged in |

Rate limited per IP and per user.

**Response 201 — logged-in user** (the campaign is suspended immediately)
```json
{
  "success": true,
  "data": {
    "reportId": "66f1d0000000000000000001",
    "requiresEmailConfirmation": false,
    "message": "Your report has been received. The campaign will be reviewed."
  }
}
```

**Response 202 — visitor** (a confirmation link is emailed; the campaign is suspended only after confirmation)
```json
{
  "success": true,
  "data": {
    "reportId": "66f1d0000000000000000002",
    "requiresEmailConfirmation": true,
    "message": "Please check your email to confirm your report."
  }
}
```

**Errors**
```json
{ "success": false, "message": "Campaign not found", "code": "NOT_FOUND" }
{ "success": false, "message": "You have already reported this campaign.", "code": "ALREADY_REPORTED" }
{ "success": false, "message": "You cannot report your own campaign.", "code": "CANNOT_REPORT_OWN_CAMPAIGN" }
{ "success": false, "message": "Too many reports. Please try again later.", "code": "TOO_MANY_REQUESTS" }
```

> **Frontend:** the visitor's email contains a link to `${FRONTEND_URL}/reports/confirm/<token>`. That page calls 5.2.

### 5.2 Confirm a Visitor Report — `[PUBLIC]`

```
POST /api/v1/reports/confirm
```
```json
{ "token": "e5f1...64 hex chars" }
```
Tokens are valid for 48 hours and single-use.

**Response 200**
```json
{ "success": true, "data": { "reportId": "66f1d0000000000000000002", "message": "Your report has been confirmed. The campaign will be reviewed." } }
```
**Errors:** `400 INVALID_TOKEN`.

### 5.3 List Reports — `ADMIN`

```
GET /api/v1/reports
```
| Query param | Values |
|---|---|
| `status` | `PENDING` (default), `REVIEWED`, `RESOLVED`, `DISMISSED`, `ALL` |
| `reason` | any reason |
| `campaignId` | filter by campaign |
| `page`, `perPage` | pagination (newest first) |

Only confirmed reports are listed.

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "66f1d0000000000000000001",
      "reason": "GAMBLING",
      "details": "Promotes a betting site",
      "status": "PENDING",
      "createdAt": "2026-10-12T10:10:00.000Z",
      "reporter": { "type": "USER", "id": "66f0cc00000000000000aa01", "fullName": "Omar K.", "email": "omar@example.com" },
      "campaign": {
        "id": "66f1a2b3c4d5e6f708192a3b",
        "name": "Ramadan Collection Launch",
        "status": "ACTIVE",
        "isSuspended": true,
        "advertiser": { "id": "66f0aa11bb22cc33dd44ee55", "fullName": "Noor Store" }
      },
      "pendingReportsForCampaign": 2,
      "reviewedAt": null,
      "actionTaken": null
    }
  ],
  "pagination": { "page": 1, "perPage": 20, "total": 1, "totalPages": 1 }
}
```
Visitor reporter: `{ "type": "VISITOR", "email": "visitor@example.com" }`.

### 5.4 Report Statistics — `ADMIN`

```
GET /api/v1/reports/statistics
```
**Response 200**
```json
{
  "success": true,
  "data": {
    "totalReports": 40,
    "pendingReports": 6,
    "resolvedReports": 20,
    "dismissedReports": 14,
    "suspendedCampaigns": 4,
    "averageReviewTimeHours": 7.5,
    "byReason": { "GAMBLING": 12, "SEXUAL_CONTENT": 5, "EXPLICIT_MUSIC": 3, "SUSPICIOUS_CURRENCIES": 2, "FALSE_CLAIMS": 8, "OTHER": 10 }
  }
}
```
`averageReviewTimeHours` is `null` when nothing has been reviewed yet.

### 5.5 Report Details — `ADMIN`

```
GET /api/v1/reports/:id
```
Returns the list item shape from 5.3 plus:
```json
{
  "campaign": { "remainingBudget": 820.0, "totalBudget": 1000.0, "brief": { "mainIdea": "..." }, "materials": [ { "fileName": "intro.mp4", "fileType": "VIDEO", "fileUrl": "https://..." } ] },
  "otherReports": [ { "id": "...", "reason": "FALSE_CLAIMS", "details": "", "status": "PENDING", "createdAt": "..." } ]
}
```
**Errors:** `404 NOT_FOUND`.

### 5.6 Review a Report — `ADMIN`

```
PUT /api/v1/reports/:id
```
```json
{ "action": "CONFIRM_VIOLATION", "note": "Promotes gambling, which violates the Halal policy" }
```
| Field | Type | Required | Rules |
|---|---|---|---|
| `action` | String | Yes | `CONFIRM_VIOLATION` or `DISMISS` |
| `note` | String | Conditional | Required for `CONFIRM_VIOLATION` (sent to the advertiser as the cancellation reason). Optional for `DISMISS` |

**Response 200 — `CONFIRM_VIOLATION`**
Campaign becomes `CANCELLED` permanently, all pending reports on this campaign become `RESOLVED`, the advertiser and reporters are notified, and the campaign's unspent budget is returned to the advertiser's wallet.
```json
{
  "success": true,
  "data": {
    "reportId": "66f1d0000000000000000001",
    "status": "RESOLVED",
    "actionTaken": "CAMPAIGN_CANCELLED",
    "resolvedReportsCount": 2,
    "campaign": { "id": "66f1a2b3c4d5e6f708192a3b", "status": "CANCELLED", "isSuspended": true },
    "budgetReleased": { "amount": 820.0, "walletBalanceAfter": 1520.0 }
  }
}
```
`budgetReleased` is `null` when the campaign has no funded budget to return.

**Response 200 — `DISMISS`**
The suspension is lifted **only if no other pending report remains** on the campaign.
```json
{
  "success": true,
  "data": {
    "reportId": "66f1d0000000000000000001",
    "status": "DISMISSED",
    "actionTaken": "SUSPENSION_LIFTED",
    "suspensionLifted": true,
    "remainingPendingReports": 0,
    "campaign": { "id": "66f1a2b3c4d5e6f708192a3b", "status": "ACTIVE", "isSuspended": false }
  }
}
```
When other pending reports remain: `"actionTaken": null`, `"suspensionLifted": false`, `"remainingPendingReports": n`.

**Errors**
```json
{ "success": false, "message": "A note is required when confirming a violation", "code": "VALIDATION_ERROR" }
{ "success": false, "message": "Report not found", "code": "NOT_FOUND" }
{ "success": false, "message": "This report has already been reviewed", "code": "REPORT_ALREADY_REVIEWED" }
```

### 5.7 What the Advertiser Sees

Existing advertiser endpoints (`GET /campaigns`, `GET /campaigns/:campaignId`, ...) now include:
```json
{ "isSuspended": true, "suspensionReason": "REPORTED", "suspendedAt": "2026-10-12T10:10:00.000Z" }
```
Show "Under review due to a report" when `isSuspended` is `true`. When a violation is confirmed, `status` becomes `CANCELLED`.

---

## 6. Notifications — any authenticated user

In-app notifications are **pull-based**: poll `unread-count` every 30–60 seconds and load the list when the user opens the bell. Notifications are deleted automatically after 90 days.

### 6.1 List

```
GET /api/v1/notifications
```
| Query param | Values |
|---|---|
| `unread` | `true` → unread only |
| `page`, `perPage` | pagination |

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "66f1e0000000000000000001",
      "type": "APPLICATION_ACCEPTED",
      "title": "Application accepted",
      "message": "Your application for \"Ramadan Collection Launch\" has been accepted.",
      "data": { "campaignId": "66f1a2b3c4d5e6f708192a3b", "applicationId": "66f1c0000000000000000001" },
      "isRead": false,
      "createdAt": "2026-10-12T11:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "perPage": 20, "total": 1, "totalPages": 1 }
}
```
> `title` and `message` are English fallbacks. **Translate in the frontend using `type` + `data`** (Arabic/English).

### 6.2 Unread Count

```
GET /api/v1/notifications/unread-count
```
```json
{ "success": true, "data": { "count": 3 } }
```

### 6.3 Mark One as Read

```
PATCH /api/v1/notifications/:id/read
```
```json
{ "success": true, "data": { "id": "66f1e0000000000000000001", "isRead": true, "readAt": "2026-10-12T11:05:00.000Z" } }
```
**Errors:** `404 NOT_FOUND` (also when it belongs to another user).

### 6.4 Mark All as Read

```
PATCH /api/v1/notifications/read-all
```
```json
{ "success": true, "data": { "updated": 3 } }
```

### 6.5 Notification Types

| `type` | Recipient | `data` | Email too? |
|---|---|---|---|
| `CAMPAIGN_REPORTED` | Advertiser | `campaignId` | Yes |
| `REPORT_RECEIVED` | All admins | `reportId`, `campaignId` | One email to the moderation address (if configured) |
| `REPORT_RESOLVED` | Reporter (logged-in) | `reportId`, `campaignId`, `outcome` (`CONFIRMED` / `DISMISSED`) | Yes (visitors get the email only) |
| `CAMPAIGN_CANCELLED_BY_REPORT` | Advertiser | `campaignId`, `note` | Yes |
| `CAMPAIGN_SUSPENSION_LIFTED` | Advertiser | `campaignId` | Yes |
| `NEW_APPLICANT` | Advertiser | `campaignId`, `applicationId`, `creatorId` | Yes |
| `APPLICATION_ACCEPTED` | Creator | `campaignId`, `applicationId` | Yes |
| `APPLICATION_REJECTED` | Creator | `campaignId`, `applicationId` | Yes |
| `FAVORITE_CAMPAIGN_UNAVAILABLE` | Creator | `campaignId`, `favoriteId`, `reason` (`BUDGET_EXHAUSTED` / `ENDED` / `NOT_AVAILABLE`) | No |
| `BUDGET_EXHAUSTED` | Advertiser | `campaignId` | Yes (existing) |

---

## 7. Changes to Existing Endpoints

| Endpoint | Change |
|---|---|
| `POST /campaigns`, `POST /campaigns/drafts`, `PUT /campaigns/drafts/:draftId` | New optional fields: `maxApplicants` (integer ≥ 1, `null` = unlimited), `requirements.minFollowers` (integer ≥ 0), `requirements.minRating` (0–5). Draft update now also accepts `startDate` and `endDate` |
| `POST /campaigns`, drafts | `targetCountries` are normalized to upper-case alpha-3; invalid or unknown codes return `400 VALIDATION_ERROR` (alpha-2 such as `SA` is converted to `SAU`) |
| `PUT /campaigns/:id/pause` | Allowed only for `ACTIVE` campaigns |
| `PUT /campaigns/:id/resume` | `409 CAMPAIGN_SUSPENDED` while the campaign is under review; `409 CAMPAIGN_UNAVAILABLE` if `CANCELLED` |
| `PUT /campaigns/:id/budget`, `POST /campaigns/:id/recharge` | `409 CAMPAIGN_UNAVAILABLE` if the campaign is `CANCELLED` (recharge on a suspended campaign is allowed) |
| `GET /campaigns`, `GET /campaigns/:campaignId` (advertiser) | Include `isSuspended`, `suspensionReason`, `suspendedAt`, `applicantsCount`, `maxApplicants`, `requirements` |

---

## 8. Known Limitations (MVP)

- **Requirements are not enforced yet:** `requirements.minFollowers/minRating` are stored and returned, but creators have no follower/rating data until social accounts are linked, so `REQUIREMENTS_NOT_MET` is never returned for now.
- **Creators must register with email + password.** "Sign in with Google" always creates a `BRAND` account.
- **Material previews are reduced-quality views, not a download lock.** Protected (signed) media URLs are planned for a later sprint.
- **Clip reports** (`POST /clips/:id/report`) are deferred until clips exist; the reports model already supports them.
- **Notifications use polling**, not WebSocket.
- **Recommendations** use creator preferences and application history only (no ratings or audience analytics yet).

---

## 9. Endpoint Summary

| # | Method | Endpoint | Auth | Description |
|---|---|---|---|---|
| 1 | GET | `/campaigns/discover` | Creator | Browse / search / filter / sort |
| 2 | GET | `/campaigns/discover/suggestions` | Creator | Search suggestions |
| 3 | GET | `/campaigns/:campaignId/details` | Creator | Campaign details |
| 4 | GET | `/campaigns/recommendations` | Creator | Recommended campaigns |
| 5 | GET | `/creator/preferences` | Creator | Get preferences |
| 6 | PUT | `/creator/preferences` | Creator | Update preferences |
| 7 | POST | `/favorites` | Creator | Add favorite |
| 8 | GET | `/favorites` | Creator | List favorites |
| 9 | DELETE | `/favorites/:id` | Creator | Remove favorite |
| 10 | POST | `/favorites/bulk-delete` | Creator | Remove several favorites |
| 11 | POST | `/campaigns/:campaignId/apply` | Creator | Apply |
| 12 | DELETE | `/applications/:id` | Creator | Withdraw application |
| 13 | GET | `/applications/my` | Creator | My applications |
| 14 | GET | `/applications/:id/materials` | Creator | Download materials (accepted only) |
| 15 | GET | `/campaigns/:campaignId/applications` | Brand | List applicants |
| 16 | PUT | `/applications/:id/status` | Brand | Accept / reject |
| 17 | POST | `/campaigns/:campaignId/report` | Optional | Report a campaign |
| 18 | POST | `/reports/confirm` | Public | Confirm a visitor report |
| 19 | GET | `/reports` | Admin | List reports |
| 20 | GET | `/reports/statistics` | Admin | Report statistics |
| 21 | GET | `/reports/:id` | Admin | Report details |
| 22 | PUT | `/reports/:id` | Admin | Confirm violation / dismiss |
| 23 | GET | `/notifications` | Any | List notifications |
| 24 | GET | `/notifications/unread-count` | Any | Unread count |
| 25 | PATCH | `/notifications/:id/read` | Any | Mark as read |
| 26 | PATCH | `/notifications/read-all` | Any | Mark all as read |

---

## 10. Notes for Backend Developers

**Route registration order matters.** Static paths must be registered before parametric ones, and the new routers must be mounted in `app.js` **before** `campaignBudgetRoutes` (that router applies `protect + requireBrandRole` to everything under `/api/v1/campaigns/:campaignId`, which would return 403 to creators):

1. `/campaigns/discover`, `/campaigns/discover/suggestions`, `/campaigns/recommendations` before any `/:campaignId` route.
2. `/reports/statistics` and `/reports/confirm` before `/reports/:id`.
3. `/favorites/bulk-delete` before `/favorites/:id`.
4. `/notifications/unread-count` and `/notifications/read-all` before `/notifications/:id/read`.
5. Routers that span several prefixes (discovery, applications, reports) are mounted on `/api/v1` with full paths and must **not** use a router-level `router.use(protect, ...)`; apply middleware per route. Single-prefix routers (favorites, creator preferences, notifications) are mounted on their own prefix with relative paths and may use `router.use(protect, ...)`.
6. Visibility rules live in one place: `utils/campaign/campaignVisibility.utils.js`. Errors via `utils/errors.js`. Pagination via `utils/paginate.utils.js`. Validation via `middlewares/validate.middleware.js`.