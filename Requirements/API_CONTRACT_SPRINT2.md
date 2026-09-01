# API Contract — Sprint 2: Campaign Management
> **Project:** Pay Per View Platform
> **Sprint:** Sprint 2 — Campaign Creation & Management
> **Base URL:** `/api/v1`
> **Authentication:** `Authorization: Bearer <token>` (مطلوب في كل endpoint ما عدا ما هو مذكور)
> **Content-Type:** `application/json` (ما عدا endpoints رفع الملفات)

---

## 📋 ملخص الـ Endpoints

| # | Method | Endpoint | الوصف | المسؤول | Role |
|---|--------|----------|-------|---------|------|
| 1 | `POST` | `/api/v1/campaigns` | إنشاء حملة جديدة | الشخص الأول | BRAND |
| 2 | `GET` | `/api/v1/campaigns/:campaignId/ai-review` | جلب نتيجة مراجعة الـ AI | الشخص الأول | BRAND |
| 3 | `POST` | `/api/v1/campaigns/drafts` | حفظ مسودة جديدة | الشخص الأول | BRAND |
| 4 | `GET` | `/api/v1/campaigns/drafts/:draftId` | جلب مسودة محددة | الشخص الأول | BRAND |
| 5 | `PUT` | `/api/v1/campaigns/drafts/:draftId` | تحديث مسودة | الشخص الأول | BRAND |
| 6 | `DELETE` | `/api/v1/campaigns/drafts/:draftId` | حذف مسودة | الشخص الأول | BRAND |
| 7 | `PATCH` | `/api/v1/campaigns/drafts/:draftId/auto-save` | Auto-Save مسودة | الشخص الأول | BRAND |
| 8 | `POST` | `/api/v1/campaigns/drafts/:draftId/submit` | تحويل مسودة إلى حملة | الشخص الأول | BRAND |
| 9 | `GET` | `/api/v1/campaigns` | جلب قائمة الحملات | الشخص الثاني | BRAND |
| 10 | `GET` | `/api/v1/campaigns/:campaignId` | جلب تفاصيل حملة | الشخص الثاني | BRAND |
| 11 | `POST` | `/api/v1/campaigns/:campaignId/copy` | نسخ حملة | الشخص الثاني | BRAND |
| 12 | `PATCH` | `/api/v1/campaigns/:campaignId/archive` | أرشفة حملة | الشخص الثاني | BRAND |
| 13 | `PATCH` | `/api/v1/campaigns/:campaignId/restore` | استعادة حملة مؤرشفة | الشخص الثاني | BRAND |
| 14 | `DELETE` | `/api/v1/campaigns/:campaignId` | حذف حملة | الشخص الثاني | BRAND |
| 15 | `POST` | `/api/v1/campaigns/bulk-delete` | حذف جماعي | الشخص الثاني | BRAND |
| 16 | `POST` | `/api/v1/campaigns/bulk-archive` | أرشفة جماعية | الشخص الثاني | BRAND |
| 17 | `GET` | `/api/v1/campaigns/:campaignId/export` | تصدير بيانات حملة CSV | الشخص الثاني | BRAND |
| 18 | `GET` | `/api/v1/campaigns/statistics` | إحصائيات لوحة التحكم | الشخص الثاني | BRAND |
| 19 | `GET` | `/api/v1/campaigns/categories` | جلب كل الفئات | الشخص الثاني | Public |
| 20 | `GET` | `/api/v1/campaigns/categories/sub-categories` | جلب الفئات الفرعية لـ MIXED | الشخص الثاني | Public |

---

## ⚠️ قيم الـ Enums المشتركة

### Campaign Status
| القيمة | الوصف |
|--------|-------|
| `DRAFT` | مسودة |
| `PENDING_REVIEW` | قيد المراجعة |
| `ACTIVE` | نشطة |
| `REJECTED` | مرفوضة |
| `MANUAL_REVIEW` | مراجعة يدوية |
| `COMPLETED` | مكتملة |
| `CANCELLED` | ملغاة |
| `ARCHIVED` | مؤرشفة |
| `EXPIRED` | منتهية الصلاحية |

### Content Type / Category
| القيمة | الوصف |
|--------|-------|
| `CLIPPING` | مقاطع فيديو قصيرة |
| `UGC` | محتوى من إنشاء المستخدمين |
| `SLIDESHOW` | عروض شرائح |
| `AUDIO` | محتوى صوتي فقط |
| `LOGO` | تحريك الشعار |
| `MIXED` | مزيج من أنواع متعددة |

### AI Review Result
| القيمة | الوصف |
|--------|-------|
| `PENDING` | قيد المراجعة |
| `APPROVED` | موافق عليها |
| `REJECTED` | مرفوضة |
| `MANUAL_REVIEW_REQUIRED` | تحتاج مراجعة يدوية |

### Material Type
| القيمة | الوصف |
|--------|-------|
| `VIDEO` | ملف فيديو |
| `IMAGE` | صورة |
| `AUDIO` | ملف صوتي |
| `TEXT` | نص |
| `LOGO` | شعار |
| `OTHER` | أخرى |

---

## 📁 Campaign Creation Pipeline (الشخص الأول)

---

### 1. إنشاء حملة جديدة

| البند | التفصيل |
|-------|---------|
| **Method** | `POST` |
| **Endpoint** | `/api/v1/campaigns` |
| **Role** | `BRAND` |
| **Content-Type** | `multipart/form-data` |

#### Request Body (form-data)
```json
{
  "name": "حملة رمضان 2026",
  "contentType": "CLIPPING",
  "category": "CLIPPING",
  "subCategories": [],
  "totalBudget": 5000,
  "cpm": 10,
  "dailyBudgetLimit": 500,
  "brief": {
    "mainIdea": "تسليط الضوء على منتجنا الجديد",
    "tone": "ودي وحيوي",
    "keyMessages": "جودة عالية، سعر مناسب",
    "keywords": ["رمضان", "عروض", "تخفيضات"],
    "visualReferences": "https://example.com/ref"
  },
  "targetCountries": ["SAU", "EGY", "ARE"],
  "halalDeclaration": {
    "noGambling": true,
    "noSexualContent": true,
    "noExplicitMusic": true,
    "noAlcohol": true,
    "noSuspiciousCurrencies": true,
    "noUnrealisticProfit": true
  },
  "files": "<binary — max 10 files, 20MB each>"
}
```

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `201` | success | تم إنشاء الحملة وإرسالها للمراجعة |
| `400` | error | حقول مفقودة أو validation فشل |
| `400` | error | MIXED بدون subCategories |
| `400` | error | إعلان الحلال غير مكتمل |
| `400` | error | تجاوز عدد الملفات (10 كحد أقصى) |
| `403` | error | المستخدم ليس BRAND |

#### Success Response `201`
```json
{
  "status": "success",
  "message": "Campaign created and submitted for review",
  "data": {
    "campaign": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "name": "حملة رمضان 2026",
      "status": "PENDING_REVIEW",
      "aiReview": {
        "result": "PENDING",
        "score": null,
        "feedback": null,
        "reviewedAt": null
      },
      "createdAt": "2026-08-13T10:00:00.000Z"
    }
  }
}
```

#### Error Responses
```json
// 400 — حقول مفقودة
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    { "field": "name", "message": "Campaign name is required" },
    { "field": "totalBudget", "message": "Total budget must be greater than 0" }
  ]
}

// 400 — MIXED بدون subCategories
{
  "status": "error",
  "message": "At least one sub-category is required when content type is MIXED"
}

// 400 — الحلال غير مكتمل
{
  "status": "error",
  "message": "All Halal declaration fields must be confirmed before submission"
}

// 400 — تجاوز عدد الملفات
{
  "status": "error",
  "message": "Cannot upload more than 10 files per campaign"
}

// 403 — ليس BRAND
{
  "status": "error",
  "message": "Access denied. Only brands can create campaigns"
}
```

---

### 2. جلب نتيجة مراجعة الـ AI

| البند | التفصيل |
|-------|---------|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/campaigns/:campaignId/ai-review` |
| **Role** | `BRAND` (صاحب الحملة فقط) |

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `200` | success | نتيجة المراجعة |
| `403` | error | ليس صاحب الحملة |
| `404` | error | الحملة غير موجودة |

#### Success Response `200`
```json
{
  "status": "success",
  "data": {
    "campaignId": "64f1a2b3c4d5e6f7a8b9c0d1",
    "campaignName": "حملة رمضان 2026",
    "aiReview": {
      "result": "APPROVED",
      "score": 92.5,
      "feedback": "Campaign meets all Halal content requirements",
      "reviewedAt": "2026-08-13T10:05:00.000Z"
    },
    "status": "ACTIVE"
  }
}
```

#### Error Responses
```json
// 404
{
  "status": "error",
  "message": "Campaign not found"
}

// 403
{
  "status": "error",
  "message": "Access denied. You do not own this campaign"
}
```

---

## 📝 Campaign Draft Pipeline (الشخص الأول)

---

### 3. حفظ مسودة جديدة

| البند | التفصيل |
|-------|---------|
| **Method** | `POST` |
| **Endpoint** | `/api/v1/campaigns/drafts` |
| **Role** | `BRAND` |
| **الحقل المطلوب الوحيد** | `name` |

#### Request Body
```json
{
  "name": "حملة صيف 2026",
  "contentType": "UGC",
  "category": "UGC",
  "subCategories": [],
  "totalBudget": 3000,
  "cpm": 8,
  "dailyBudgetLimit": null,
  "brief": {
    "mainIdea": "",
    "tone": "",
    "keyMessages": "",
    "keywords": [],
    "visualReferences": ""
  },
  "targetCountries": [],
  "halalDeclared": false
}
```

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `201` | success | تم حفظ المسودة |
| `400` | error | اسم الحملة مفقود |

#### Success Response `201`
```json
{
  "status": "success",
  "message": "Draft saved successfully",
  "data": {
    "draft": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
      "name": "حملة صيف 2026",
      "status": "DRAFT",
      "version": 1,
      "lastSavedAt": "2026-08-13T10:00:00.000Z",
      "expiresAt": "2026-09-12T10:00:00.000Z"
    }
  }
}
```

#### Error Response
```json
// 400
{
  "status": "error",
  "message": "Campaign name is required to save draft"
}
```

---

### 4. جلب مسودة محددة

| البند | التفصيل |
|-------|---------|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/campaigns/drafts/:draftId` |
| **Role** | `BRAND` (صاحب المسودة فقط) |

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `200` | success | بيانات المسودة كاملة |
| `403` | error | ليس صاحب المسودة |
| `404` | error | المسودة غير موجودة |

#### Success Response `200`
```json
{
  "status": "success",
  "data": {
    "draft": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
      "name": "حملة صيف 2026",
      "contentType": "UGC",
      "category": "UGC",
      "subCategories": [],
      "totalBudget": 3000,
      "cpm": 8,
      "dailyBudgetLimit": null,
      "brief": {
        "mainIdea": "",
        "tone": "",
        "keyMessages": "",
        "keywords": [],
        "visualReferences": ""
      },
      "targetCountries": [],
      "halalDeclared": false,
      "materials": [],
      "status": "DRAFT",
      "version": 1,
      "lastSavedAt": "2026-08-13T10:00:00.000Z",
      "expiresAt": "2026-09-12T10:00:00.000Z",
      "createdAt": "2026-08-13T10:00:00.000Z"
    }
  }
}
```

#### Error Responses
```json
// 404
{ "status": "error", "message": "Draft not found" }

// 403
{ "status": "error", "message": "Access denied. You do not own this draft" }
```

---

### 5. تحديث مسودة

| البند | التفصيل |
|-------|---------|
| **Method** | `PUT` |
| **Endpoint** | `/api/v1/campaigns/drafts/:draftId` |
| **Role** | `BRAND` (صاحب المسودة فقط) |
| **ملاحظة** | كل الحقول اختيارية |

#### Request Body
```json
{
  "name": "حملة صيف 2026 — محدثة",
  "totalBudget": 4000,
  "brief": {
    "mainIdea": "فكرة محدثة",
    "keywords": ["صيف", "عروض"]
  }
}
```

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `200` | success | تم التحديث |
| `400` | error | المسودة منتهية الصلاحية |
| `403` | error | ليس صاحب المسودة |
| `404` | error | المسودة غير موجودة |

#### Success Response `200`
```json
{
  "status": "success",
  "message": "Draft updated successfully",
  "data": {
    "draft": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
      "name": "حملة صيف 2026 — محدثة",
      "version": 2,
      "lastSavedAt": "2026-08-13T10:30:00.000Z",
      "expiresAt": "2026-09-12T10:00:00.000Z"
    }
  }
}
```

#### Error Responses
```json
// 400 — منتهية الصلاحية
{
  "status": "error",
  "message": "This draft has expired and cannot be edited"
}

// 404
{ "status": "error", "message": "Draft not found" }
```

---

### 6. حذف مسودة

| البند | التفصيل |
|-------|---------|
| **Method** | `DELETE` |
| **Endpoint** | `/api/v1/campaigns/drafts/:draftId` |
| **Role** | `BRAND` (صاحب المسودة فقط) |

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `200` | success | تم الحذف |
| `403` | error | ليس صاحب المسودة |
| `404` | error | المسودة غير موجودة |

#### Success Response `200`
```json
{
  "status": "success",
  "message": "Draft deleted successfully"
}
```

#### Error Responses
```json
// 404
{ "status": "error", "message": "Draft not found" }

// 403
{ "status": "error", "message": "Access denied. You do not own this draft" }
```

---

### 7. Auto-Save مسودة

| البند | التفصيل |
|-------|---------|
| **Method** | `PATCH` |
| **Endpoint** | `/api/v1/campaigns/drafts/:draftId/auto-save` |
| **Role** | `BRAND` (صاحب المسودة فقط) |
| **ملاحظة** | يُرسل فقط الحقول التي تغيرت |

#### Request Body
```json
{
  "brief": {
    "mainIdea": "تحديث تلقائي للفكرة"
  },
  "totalBudget": 4500
}
```

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `200` | success | تم الحفظ التلقائي |
| `409` | error | تعارض في الـ version |

#### Success Response `200`
```json
{
  "status": "success",
  "message": "Draft auto-saved",
  "data": {
    "version": 3,
    "lastSavedAt": "2026-08-13T10:35:00.000Z"
  }
}
```

#### Error Response
```json
// 409 — version conflict
{
  "status": "error",
  "message": "Draft version conflict. Please refresh and try again",
  "data": {
    "currentVersion": 4,
    "yourVersion": 3
  }
}
```

---

### 8. تحويل مسودة إلى حملة (Submit)

| البند | التفصيل |
|-------|---------|
| **Method** | `POST` |
| **Endpoint** | `/api/v1/campaigns/drafts/:draftId/submit` |
| **Role** | `BRAND` (صاحب المسودة فقط) |
| **ملاحظة** | البيانات موجودة في المسودة — الـ body فارغ |

#### Request Body
```json
{}
```

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `201` | success | تم تحويل المسودة لحملة |
| `400` | error | المسودة غير مكتملة |
| `400` | error | المسودة منتهية الصلاحية |
| `403` | error | ليس صاحب المسودة |
| `404` | error | المسودة غير موجودة |

#### Success Response `201`
```json
{
  "status": "success",
  "message": "Draft submitted as campaign successfully",
  "data": {
    "campaign": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d3",
      "name": "حملة صيف 2026",
      "status": "PENDING_REVIEW",
      "aiReview": {
        "result": "PENDING"
      },
      "createdAt": "2026-08-13T11:00:00.000Z"
    }
  }
}
```

#### Error Responses
```json
// 400 — حقول مفقودة
{
  "status": "error",
  "message": "Cannot submit incomplete draft",
  "errors": [
    { "field": "targetCountries", "message": "At least one target country is required" },
    { "field": "halalDeclaration", "message": "Halal declaration must be completed" }
  ]
}

// 400 — منتهية الصلاحية
{
  "status": "error",
  "message": "This draft has expired and cannot be submitted"
}
```

---

## 📊 Campaign Management Pipeline (الشخص الثاني)

---

### 9. جلب قائمة الحملات

| البند | التفصيل |
|-------|---------|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/campaigns` |
| **Role** | `BRAND` |

#### Query Parameters

| Parameter | النوع | القيم المتاحة | الافتراضي |
|-----------|-------|---------------|-----------|
| `status` | string | `DRAFT` \| `PENDING_REVIEW` \| `ACTIVE` \| `REJECTED` \| `MANUAL_REVIEW` \| `COMPLETED` \| `CANCELLED` \| `ARCHIVED` \| `EXPIRED` \| `ALL` | `ALL` |
| `category` | string | `CLIPPING` \| `UGC` \| `SLIDESHOW` \| `AUDIO` \| `LOGO` \| `MIXED` | — |
| `dateFrom` | string | ISO date (مثال: `2026-01-01`) | — |
| `dateTo` | string | ISO date (مثال: `2026-08-31`) | — |
| `search` | string | البحث في اسم الحملة | — |
| `sortBy` | string | `createdAt` \| `name` \| `totalBudget` | `createdAt` |
| `sortOrder` | string | `asc` \| `desc` | `desc` |
| `page` | number | — | `1` |
| `limit` | number | max: `50` | `20` |
| `isArchived` | boolean | `true` \| `false` | `false` |

#### مثال على الطلب
```
GET /api/v1/campaigns?status=ACTIVE&category=CLIPPING&page=1&limit=20&sortBy=createdAt&sortOrder=desc
```

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `200` | success | قائمة الحملات مع pagination |
| `400` | error | query parameters غير صالحة |

#### Success Response `200`
```json
{
  "status": "success",
  "data": {
    "campaigns": [
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
        "name": "حملة رمضان 2026",
        "status": "ACTIVE",
        "category": "CLIPPING",
        "contentType": "CLIPPING",
        "totalBudget": 5000,
        "remainingBudget": 3200,
        "cpm": 10,
        "targetCountries": ["SAU", "EGY", "ARE"],
        "stats": {
          "totalViews": 120000,
          "totalApprovedVideos": 15,
          "totalCreators": 8,
          "totalSpent": 1800
        },
        "aiReview": {
          "result": "APPROVED",
          "score": 92.5
        },
        "isArchived": false,
        "createdAt": "2026-08-13T10:00:00.000Z",
        "submittedAt": "2026-08-13T10:05:00.000Z",
        "activatedAt": "2026-08-13T10:10:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCampaigns": 98,
      "limit": 20,
      "hasNextPage": true,
      "hasPrevPage": false
    },
    "summary": {
      "total": 98,
      "active": 12,
      "pending": 5,
      "completed": 30,
      "draft": 10,
      "rejected": 8,
      "archived": 33
    }
  }
}
```

---

### 10. جلب تفاصيل حملة محددة

| البند | التفصيل |
|-------|---------|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/campaigns/:campaignId` |
| **Role** | `BRAND` (صاحب الحملة فقط) |

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `200` | success | تفاصيل الحملة كاملة مع سجل النشاطات |
| `403` | error | ليس صاحب الحملة |
| `404` | error | الحملة غير موجودة |

#### Success Response `200`
```json
{
  "status": "success",
  "data": {
    "campaign": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "name": "حملة رمضان 2026",
      "contentType": "CLIPPING",
      "category": "CLIPPING",
      "subCategories": [],
      "totalBudget": 5000,
      "remainingBudget": 3200,
      "cpm": 10,
      "dailyBudgetLimit": 500,
      "brief": {
        "mainIdea": "تسليط الضوء على منتجنا الجديد",
        "tone": "ودي وحيوي",
        "keyMessages": "جودة عالية، سعر مناسب",
        "keywords": ["رمضان", "عروض", "تخفيضات"],
        "visualReferences": "https://example.com/ref"
      },
      "targetCountries": ["SAU", "EGY", "ARE"],
      "status": "ACTIVE",
      "aiReview": {
        "result": "APPROVED",
        "score": 92.5,
        "feedback": "Campaign meets all Halal content requirements",
        "reviewedAt": "2026-08-13T10:05:00.000Z"
      },
      "halalDeclaration": {
        "noGambling": true,
        "noSexualContent": true,
        "noExplicitMusic": true,
        "noAlcohol": true,
        "noSuspiciousCurrencies": true,
        "noUnrealisticProfit": true,
        "declaredAt": "2026-08-13T10:00:00.000Z"
      },
      "materials": [
        {
          "_id": "64f1a2b3c4d5e6f7a8b9c0d4",
          "fileName": "product-video.mp4",
          "fileUrl": "https://storage.example.com/campaigns/product-video.mp4",
          "fileType": "VIDEO",
          "fileSizeKb": 15360,
          "mimeType": "video/mp4",
          "isPrimary": true,
          "uploadedAt": "2026-08-13T10:00:00.000Z"
        }
      ],
      "stats": {
        "totalViews": 120000,
        "totalApprovedVideos": 15,
        "totalCreators": 8,
        "totalSpent": 1800
      },
      "copyInfo": {
        "isCopy": false,
        "copiedFromId": null
      },
      "copyCount": 2,
      "isArchived": false,
      "statusHistory": [
        {
          "action": "CREATED",
          "performedBy": null,
          "createdAt": "2026-08-13T10:00:00.000Z"
        },
        {
          "action": "SUBMITTED",
          "performedBy": "64f1a2b3c4d5e6f7a8b9c0d0",
          "createdAt": "2026-08-13T10:02:00.000Z"
        },
        {
          "action": "AI_APPROVED",
          "performedBy": null,
          "createdAt": "2026-08-13T10:05:00.000Z"
        },
        {
          "action": "ACTIVATED",
          "performedBy": null,
          "createdAt": "2026-08-13T10:10:00.000Z"
        }
      ],
      "createdAt": "2026-08-13T10:00:00.000Z",
      "updatedAt": "2026-08-13T10:10:00.000Z",
      "submittedAt": "2026-08-13T10:02:00.000Z",
      "activatedAt": "2026-08-13T10:10:00.000Z",
      "completedAt": null
    }
  }
}
```

#### Error Responses
```json
// 404
{ "status": "error", "message": "Campaign not found" }

// 403
{ "status": "error", "message": "Access denied. You do not own this campaign" }
```

---

### 11. نسخ حملة

| البند | التفصيل |
|-------|---------|
| **Method** | `POST` |
| **Endpoint** | `/api/v1/campaigns/:campaignId/copy` |
| **Role** | `BRAND` (صاحب الحملة فقط) |

#### Request Body
```json
{
  "newName": "حملة رمضان 2026 — نسخة",
  "includeMaterials": true
}
```

> **ملاحظة:** `newName` اختياري — إذا لم يُرسَل يضيف النظام `(Copy)` تلقائياً

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `201` | success | تم إنشاء نسخة كمسودة |
| `403` | error | ليس صاحب الحملة |
| `404` | error | الحملة غير موجودة |

#### Success Response `201`
```json
{
  "status": "success",
  "message": "Campaign copied successfully",
  "data": {
    "draft": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d5",
      "name": "حملة رمضان 2026 — نسخة",
      "status": "DRAFT",
      "copyInfo": {
        "isCopy": true,
        "copiedFromId": "64f1a2b3c4d5e6f7a8b9c0d1"
      },
      "createdAt": "2026-08-13T12:00:00.000Z"
    }
  }
}
```

---

### 12. أرشفة حملة

| البند | التفصيل |
|-------|---------|
| **Method** | `PATCH` |
| **Endpoint** | `/api/v1/campaigns/:campaignId/archive` |
| **Role** | `BRAND` (صاحب الحملة فقط) |

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `200` | success | تم الأرشفة |
| `400` | error | لا يمكن أرشفة حملة نشطة |
| `403` | error | ليس صاحب الحملة |
| `404` | error | الحملة غير موجودة |

#### Success Response `200`
```json
{
  "status": "success",
  "message": "Campaign archived successfully",
  "data": {
    "campaignId": "64f1a2b3c4d5e6f7a8b9c0d1",
    "isArchived": true,
    "archivedAt": "2026-08-13T12:00:00.000Z"
  }
}
```

#### Error Response
```json
// 400
{
  "status": "error",
  "message": "Active campaigns cannot be archived. Please cancel the campaign first"
}
```

---

### 13. استعادة حملة مؤرشفة

| البند | التفصيل |
|-------|---------|
| **Method** | `PATCH` |
| **Endpoint** | `/api/v1/campaigns/:campaignId/restore` |
| **Role** | `BRAND` (صاحب الحملة فقط) |

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `200` | success | تم الاستعادة |
| `400` | error | الحملة ليست مؤرشفة |
| `403` | error | ليس صاحب الحملة |
| `404` | error | الحملة غير موجودة |

#### Success Response `200`
```json
{
  "status": "success",
  "message": "Campaign restored successfully",
  "data": {
    "campaignId": "64f1a2b3c4d5e6f7a8b9c0d1",
    "isArchived": false,
    "status": "COMPLETED"
  }
}
```

---

### 14. حذف حملة

| البند | التفصيل |
|-------|---------|
| **Method** | `DELETE` |
| **Endpoint** | `/api/v1/campaigns/:campaignId` |
| **Role** | `BRAND` (صاحب الحملة فقط) |
| **ملاحظة** | مسموح فقط للحالات: `DRAFT` أو `REJECTED` |

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `200` | success | تم الحذف |
| `400` | error | لا يمكن حذف حملة نشطة |
| `403` | error | ليس صاحب الحملة |
| `404` | error | الحملة غير موجودة |

#### Success Response `200`
```json
{
  "status": "success",
  "message": "Campaign deleted successfully"
}
```

#### Error Response
```json
// 400
{
  "status": "error",
  "message": "Only DRAFT or REJECTED campaigns can be deleted"
}
```

---

### 15. حذف جماعي

| البند | التفصيل |
|-------|---------|
| **Method** | `POST` |
| **Endpoint** | `/api/v1/campaigns/bulk-delete` |
| **Role** | `BRAND` |

#### Request Body
```json
{
  "campaignIds": [
    "64f1a2b3c4d5e6f7a8b9c0d1",
    "64f1a2b3c4d5e6f7a8b9c0d2"
  ]
}
```

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `200` | success | نتيجة الحذف الجماعي |
| `400` | error | campaignIds فارغة أو غير صالحة |

#### Success Response `200`
```json
{
  "status": "success",
  "message": "Bulk delete completed",
  "data": {
    "deleted": 2,
    "failed": 0,
    "failedIds": []
  }
}
```

---

### 16. أرشفة جماعية

| البند | التفصيل |
|-------|---------|
| **Method** | `POST` |
| **Endpoint** | `/api/v1/campaigns/bulk-archive` |
| **Role** | `BRAND` |

#### Request Body
```json
{
  "campaignIds": [
    "64f1a2b3c4d5e6f7a8b9c0d1",
    "64f1a2b3c4d5e6f7a8b9c0d2"
  ]
}
```

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `200` | success | نتيجة الأرشفة الجماعية |
| `400` | error | campaignIds فارغة أو غير صالحة |

#### Success Response `200`
```json
{
  "status": "success",
  "message": "Bulk archive completed",
  "data": {
    "archived": 2,
    "failed": 0,
    "failedIds": []
  }
}
```

---

### 17. تصدير بيانات حملة (CSV)

| البند | التفصيل |
|-------|---------|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/campaigns/:campaignId/export` |
| **Role** | `BRAND` (صاحب الحملة فقط) |

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `200` | success | ملف CSV |
| `403` | error | ليس صاحب الحملة |
| `404` | error | الحملة غير موجودة |

#### Success Response `200`
```
Content-Type: text/csv
Content-Disposition: attachment; filename="campaign-64f1a2b3-export.csv"

<CSV content>
```

---

### 18. إحصائيات لوحة التحكم

| البند | التفصيل |
|-------|---------|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/campaigns/statistics` |
| **Role** | `BRAND` |

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `200` | success | إحصائيات الحملات |

#### Success Response `200`
```json
{
  "status": "success",
  "data": {
    "statistics": {
      "totalCampaigns": 98,
      "activeCampaigns": 12,
      "completedCampaigns": 30,
      "draftCampaigns": 10,
      "rejectedCampaigns": 8,
      "pendingCampaigns": 5,
      "archivedCampaigns": 33,
      "totalBudgetSpent": 45000,
      "averageCpm": 9.5,
      "byCategory": {
        "CLIPPING": 35,
        "UGC": 20,
        "SLIDESHOW": 15,
        "AUDIO": 10,
        "LOGO": 8,
        "MIXED": 10
      }
    }
  }
}
```

---

## 🏷️ Campaign Category Pipeline (الشخص الثاني)

---

### 19. جلب كل الفئات

| البند | التفصيل |
|-------|---------|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/campaigns/categories` |
| **Role** | Public (لا يحتاج authentication) |

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `200` | success | قائمة الفئات مع أوصافها |

#### Success Response `200`
```json
{
  "status": "success",
  "data": {
    "categories": [
      {
        "name": "CLIPPING",
        "description": "مقاطع فيديو قصيرة من المواد المصدر",
        "icon": "scissors",
        "allowsSubCategories": false,
        "subCategories": []
      },
      {
        "name": "UGC",
        "description": "محتوى من إنشاء المستخدمين",
        "icon": "user-video",
        "allowsSubCategories": false,
        "subCategories": []
      },
      {
        "name": "SLIDESHOW",
        "description": "عروض شرائح من الصور مع انتقالات",
        "icon": "images",
        "allowsSubCategories": false,
        "subCategories": []
      },
      {
        "name": "AUDIO",
        "description": "محتوى صوتي فقط",
        "icon": "microphone",
        "allowsSubCategories": false,
        "subCategories": []
      },
      {
        "name": "LOGO",
        "description": "تحريك الشعار أو التصميم",
        "icon": "badge",
        "allowsSubCategories": false,
        "subCategories": []
      },
      {
        "name": "MIXED",
        "description": "مزيج من أنواع محتوى متعددة",
        "icon": "grid",
        "allowsSubCategories": true,
        "subCategories": ["CLIPPING", "UGC", "SLIDESHOW", "AUDIO", "LOGO"]
      }
    ]
  }
}
```

---

### 20. جلب الفئات الفرعية لـ MIXED

| البند | التفصيل |
|-------|---------|
| **Method** | `GET` |
| **Endpoint** | `/api/v1/campaigns/categories/sub-categories` |
| **Role** | Public (لا يحتاج authentication) |

#### Responses

| Status Code | الحالة | الوصف |
|-------------|--------|-------|
| `200` | success | قائمة الفئات الفرعية المتاحة |

#### Success Response `200`
```json
{
  "status": "success",
  "data": {
    "subCategories": ["CLIPPING", "UGC", "SLIDESHOW", "AUDIO", "LOGO"]
  }
}
```

---

## ⚠️ ملاحظات مهمة للتطوير

### ترتيب الـ Routes (مهم جداً)
في Express، يجب تسجيل الـ routes الثابتة **قبل** الـ routes التي تحتوي على `:id`:

```javascript
// ✅ الترتيب الصحيح
router.get('/statistics', ...)                    // أولاً — ثابت
router.get('/categories', ...)                    // أولاً — ثابت
router.get('/categories/sub-categories', ...)     // أولاً — ثابت
router.post('/bulk-delete', ...)                  // أولاً — ثابت
router.post('/bulk-archive', ...)                 // أولاً — ثابت
router.post('/drafts', ...)                       // أولاً — ثابت
router.get('/drafts/:draftId', ...)               // بعد — يحتوي :id
router.get('/', ...)                              // القائمة العامة
router.get('/:campaignId', ...)                   // أخيراً — يحتوي :id
router.post('/:campaignId/copy', ...)             // أخيراً — يحتوي :id
```

### قيود رفع الملفات
| القيد | القيمة |
|-------|--------|
| الحد الأقصى للملفات | 10 ملفات |
| الحد الأقصى لحجم الملف | 20 MB |
| الصيغ المدعومة | MP4, JPG, PNG, PDF, MP3, SVG |

### الحالات التي يُسمح فيها بالحذف
| الحالة | الحذف مسموح؟ |
|--------|-------------|
| `DRAFT` | ✅ نعم |
| `REJECTED` | ✅ نعم |
| `PENDING_REVIEW` | ❌ لا |
| `ACTIVE` | ❌ لا |
| `COMPLETED` | ❌ لا |
| `ARCHIVED` | ❌ لا |

### الحالات التي يُسمح فيها بالأرشفة
| الحالة | الأرشفة مسموحة؟ |
|--------|----------------|
| `COMPLETED` | ✅ نعم |
| `REJECTED` | ✅ نعم |
| `CANCELLED` | ✅ نعم |
| `EXPIRED` | ✅ نعم |
| `ACTIVE` | ❌ لا |
| `PENDING_REVIEW` | ❌ لا |
| `DRAFT` | ❌ لا |
