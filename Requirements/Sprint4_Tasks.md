# Sprint 4 — Tasks & Subtasks

> **Sprint:** Sprint 4 — Campaign Discovery and Application (Content Creator)
> **Reference:** `API_CONTRACT_Sprint4.md` (كل الـ endpoints والأكواد والأمثلة)
> **التقسيم:** حسب الميزة.
> - **الشخص A** = الإشعارات + الإشراف (البلاغات والإيقاف) + مراجعة المتقدمين (جانب المعلن) + المفضلة + الـ hooks + ملكية الجودة (اختبارات التكامل وإصلاح `freeBalance`).
> - **الشخص B** = الاكتشاف والتفاصيل + التقديم (جانب المبدع) + التفضيلات والتوصيات.
>
> **أسلوب الكود:** Joi + `middlewares/validate.middleware.js` للتحقق، `utils/errors.js` (`AppError`, `sendError`) للأخطاء، `utils/paginate.utils.js` للترقيم، `utils/campaign/campaignVisibility.utils.js` لقواعد الظهور.
>
> ⚠️ **تنبيه عن تعليقات الـ stubs:** تعليقات `TODO(B)` داخل `favorite.routes.js` وداخل `application.routes.js` (مساري المعلن) كُتبت قبل إعادة التقسيم. **المعتمد هو هذا الملف**: المفضلة كلها لـ A، ومساراً المعلن في التقديم (`GET /campaigns/:campaignId/applications` و`PUT /applications/:id/status`) لـ A.

---

## 0. شرط البدء المتوازي (Gate) — يُنجَز مرة واحدة قبل أن يبدأ أي منكما

> الهدف: أن يكون كل ما يشترك فيه الشخصان مدموجاً في فرع `develop` قبل التفرّع، فلا يتعارضان على الملفات المشتركة.

### 0.1 ملفات جديدة تُنسخ كما هي
- [ ] `src/models/`: `report.js`, `application.js`, `favorite.js`, `creatorPreferences.js`, `notification.js`
- [ ] `src/utils/`: `errors.js`, `countries.utils.js`, `paginate.utils.js`
- [ ] `src/utils/campaign/`: `campaignVisibility.utils.js`
- [ ] `src/middlewares/validate.middleware.js`
- [ ] `src/services/notification/`: `notification.service.js`, `notification.templates.js`, `notificationEmails.js`
- [ ] `src/routes/` (هياكل فارغة): `campaign/campaignDiscovery.routes.js`, `application/application.routes.js`, `moderation/report.routes.js`, `creator/favorite.routes.js`, `creator/creatorPreferences.routes.js`, `notification/notification.routes.js`
- [ ] `scripts/createAdmin.js`, `scripts/migrateSprint4.js`
- [ ] `src/constants/discovery.constants.js` ✅ (موجود)

### 0.2 ملفات تُستبدل أو تُعدَّل
- [ ] `src/utils/campaign/campaignStatus.utils.js` ← استبدال كامل (انتقالات جديدة + `isCancellable` + `isCampaignSuspended`)
- [ ] `src/services/wallet/campaignBudget.service.js` ← استبدال كامل (إصلاح التمويل + حراس الإلغاء/الإيقاف + `releaseCampaignBudget`)
- [ ] `src/controllers/wallet/campaignBudget.controller.js` ← احذف `getStatusFromCode` المحلية و`const { getStatusFromCode } = require('../../utils/errors');`
- [ ] `src/app.js` ← استبدال (إضافة routers سبرنت 4 **قبل** `campaignBudgetRoutes`)
- [ ] `src/models/campaign.js` ← حقول `isSuspended, suspensionReason, suspendedAt, applicantsCount, maxApplicants, requirements` + 4 indexes
- [ ] `src/models/CampaignDraft.js` ← `maxApplicants`, `requirements`
- [ ] `src/middlewares/authMiddleware.js` ← `optionalAuth`
- [ ] `src/middlewares/campaign/campaignValidationMiddleware.js` ← `requireClipperRole` (وتصديرها)
- [ ] `src/validators/campaign/campaignCreation.validator.js` ← تطبيع `targetCountries` + قواعد `maxApplicants`/`requirements`
- [ ] `src/validators/campaign/campaignDraft.validator.js` ← نفس التعديلات + `startDate`/`endDate`
- [ ] `src/services/campaign/campaignCreation.service.js` ← `maxApplicants` و`requirements` داخل `Campaign.create`
- [ ] `src/services/campaign/campaignDraft.service.js` ← إصلاح `sendEmail` + `DRAFT_UPDATABLE_FIELDS` + الحقلان في `createDraft`
- [ ] `src/services/campaign/campaignManagement.service.js` ← `copyCampaign` تنسخ `maxApplicants`/`requirements`

### 0.3 البيئة
- [ ] أضف إلى `.env` (محلياً وعلى Render):
  - `MODERATION_TEAM_EMAIL=` (اختياري؛ إن فارغ لا يُرسل بريد للفريق)
  - `IP_HASH_SECRET=` (نص عشوائي طويل؛ لتشفير عنوان IP في البلاغات)
  - `ADMIN_EMAIL=` و`ADMIN_PASSWORD=` (مؤقتاً لـ `createAdmin.js`، ثم احذف كلمة المرور)
- [ ] `node scripts/createAdmin.js` ثم تسجيل الدخول كأدمن
- [ ] (اختياري محلياً، إلزامي على قاعدة بيانات فيها حملات حقيقية) `node scripts/migrateSprint4.js`

### 0.4 تحقق نهائي قبل التفرّع
- [ ] السيرفر يقلع بدون أخطاء `require` (تذكّر حالة الأحرف: Windows لا يفرّق، Render/Linux يفرّق)
- [ ] اختبارات سبرنت 2 و3 الموجودة تنجح (تعديل `campaignStatus.utils` و`campaignBudget.service` قد يغيّر نتائج بعضها، وهذا متوقع في اختبار recharge على حملة غير مموّلة)
- [ ] حملة اختبار تمر بالمسار: إنشاء → `PUT /budget` → `triggerAIReview` (أو تعديل `status` يدوياً إلى `ACTIVE`) وتظهر بـ `walletId` غير فارغة
- [ ] دمج كل ما سبق في `develop` ثم يتفرّع كل شخص: `feature/s4-moderation` (A) و`feature/s4-discovery` (B)

---

## 1. قواعد العمل المتوازي

### 1.1 من يملك ماذا
| الملف / المجلد | المالك |
|---|---|
| `notification.*` (controller, validator, routes) | A |
| `report.*` (service, controller, validator, routes, rate limiter) | A |
| `applicationReview.*` (service, controller, validator) + مساراه في `application.routes.js` | A |
| `favorite.*` (service, controller, validator, routes) | A |
| `favoriteNotifications.service.js` + استدعاءات الـ hooks في jobs | A |
| `freeBalance.utils.js` (إصلاح) + اختبارات التكامل | A |
| `campaignDiscovery.*`, `materialPreview.utils.js` | B |
| `application.service.js`, `application.controller.js`, `application.validator.js` + مسارات المبدع في `application.routes.js` | B |
| `creatorPreferences.*` | B |
| `matchScore.utils.js`, `campaignRecommendation.service.js` | B |

### 1.2 ملف واحد بمالكَين: `application.routes.js`
- **B** يكتب مسارات المبدع (`apply`, `my`, `materials`, `withdraw`).
- **A** يضيف مساري المعلن في **قسم منفصل أسفل الملف** تحت تعليق `// ── Advertiser side (owner: A) ──`.
- كل منكما يضيف قسمه في commit مستقل ويسحب من `develop` قبل الدفع، فلا يتعارض التعديلان (مقاطع مختلفة من الملف).
- لا ترتيب خاص بين القسمين (المسارات مختلفة الطول: `/applications/my` مقابل `/applications/:id/status`).

### 1.3 الملفات المشتركة (أنجزناها في Gate، لا تُعدَّل بعده بدون إبلاغ الآخر)
`app.js`, `campaign.js`, `discovery.constants.js`, `errors.js`, `campaignVisibility.utils.js`, `campaignStatus.utils.js`, `notification.service.js`, `notification.templates.js`, `notificationEmails.js`, `emailService.js`.
- تعديل ملف مشترك يكون في **commit صغير مستقل** على `develop` ثم يسحبه الآخر.
- إضافة نوع إشعار جديد = إضافة إلى `NOTIFICATION_TYPE` + قالب في `notification.templates.js` + سطر في العقد، في commit واحد.

### 1.4 عداد المتقدمين `applicantsCount` (يتعدّل عند الشخصين)
- B: `+1` عند التقديم (بشرط الحد)، و`-1` عند السحب.
- A: `-1` عند الرفض.
- القاعدة: كل تنقيص بـ `$inc: { applicantsCount: -1 }` **مع شرط** `applicantsCount: { $gt: 0 }` في الفلتر حتى لا ينزل تحت الصفر.
- القبول لا يغيّر `applicantsCount`، ويزيد `stats.totalCreators` (عند A).

### 1.5 قواعد الكود (للجميع)
- لا `router.use(protect, ...)` في routers الممتدة على أكثر من بادئة (discovery, applications, reports). الـ middleware على كل route.
- الـ controllers الجديدة: `try { ... } catch (error) { return sendError(res, error, 'controller.name'); }`.
- الخدمات ترمي `new AppError(message, 'CODE')` بالأكواد الموجودة في العقد.
- الإشعارات تُرسل **بعد** commit للـ transaction، عبر `notifyUser(userId, buildNotification(...), emailFn)`.
- كتابة `CampaignActivityLog` داخل transaction تكون بـ `CampaignActivityLog.create([{...}], { session })` (`logActivity` يبتلع الأخطاء ولا يشارك في الـ session).

### 1.6 المراجعة المتبادلة
- **B تراجع** `reviewReport` و`releaseCampaignBudget` عند A (يمسّان المال).
- **A يراجع** `applyToCampaign` عند B (الأحسّ بالتزامن عند حد المتقدمين).

---

## 👤 الشخص A — الإشعارات والإشراف والمفضلة ومراجعة المتقدمين والجودة

> ترتيب العمل المقترح: A1 → A2 → A3 → A4 → A5 → A6. الأولويات في السبرنت: البلاغات والتقديم **High**، المفضلة **Medium** (تأتي في آخر القائمة، وإن ضاق الوقت فهي أول ما يُؤجَّل).

### المرحلة A1: واجهة الإشعارات (قصيرة، تُنجَز أولاً لأن الجميع يستفيد منها)

#### A-01: Notification API
- [ ] `src/validators/notification/notification.validator.js` (Joi): query (`unread` boolean, `page`, `perPage`) + params (`id` ObjectId)
- [ ] `src/controllers/notification/notification.controller.js`: 4 handlers تستدعي `getUserNotifications`, `getUnreadCount`, `markAsRead`, `markAllAsRead` (جاهزة في الخدمة)
- [ ] ملء `notification.routes.js` (يحق `router.use(protect)`) بالترتيب: `GET /`, `GET /unread-count`, `PATCH /read-all`, `PATCH /:id/read`
- [ ] الاستجابات مطابقة للعقد §6 (القائمة بـ `pagination`)

### المرحلة A2: البلاغات والإيقاف (R2.03, R2.07) — **High**

#### A-02: أدوات مساعدة
- [ ] `src/middlewares/moderation/reportRateLimiter.js`: حد لكل IP ولكل مستخدم (استفد من المكتبة المستعملة في `middlewares/ai/rateLimiter.js`)، الخطأ `429 TOO_MANY_REQUESTS`
- [ ] `src/validators/moderation/report.validator.js` (Joi):
  - إرسال بلاغ: `reason` (من `REPORT_REASON`)، `details` (≤1000، **إلزامي لـ OTHER**)، `email` (إلزامي إن لم يوجد JWT)
  - `confirm`: `token` (64 hex)
  - قائمة: `status`, `reason`, `campaignId`, `page`, `perPage`
  - مراجعة: `action` (`CONFIRM_VIOLATION|DISMISS`)، `note` (**إلزامي عند التأكيد**)

#### A-03: `src/services/moderation/report.service.js`
- [ ] `hashIp(ip)`: HMAC-SHA256 بـ `IP_HASH_SECRET` (لا نخزن IP خام)
- [ ] `submitReport(campaignId, reporter, { reason, details, email }, ip)`:
  - الحملة موجودة و`isReportable(campaign)` وإلا `NOT_FOUND`
  - المعلن صاحب الحملة → `CANNOT_REPORT_OWN_CAMPAIGN`
  - التكرار → `ALREADY_REPORTED` (التقط خطأ `11000` من الـ unique index أيضاً)
  - **مسجّل:** `isConfirmed = true`، ثم `suspendCampaignForReport` فوراً
  - **زائر:** `isConfirmed = false` + توكن عشوائي (نخزّن hash فقط) + `confirmationExpiresAt` بعد 48 ساعة + إرسال رابط `${FRONTEND_URL}/reports/confirm/<token>` بالبريد
- [ ] `suspendCampaignForReport(campaign, report, session)` (داخل transaction واحدة مع إنشاء البلاغ):
  - إن لم تكن موقوفة: `isSuspended = true`, `suspensionReason = 'REPORTED'`, `suspendedAt = now`
  - `CampaignActivityLog` بـ `REPORTED` و`SUSPENDED`
  - **بعد الـ commit** (فقط إن كان الإيقاف جديداً): إشعار + بريد المعلن (`CAMPAIGN_REPORTED`)، وإشعار الأدمن (`notifyAdmins` + بريد الفريق)
- [ ] `confirmVisitorReport(token)`: البحث بالـ hash، `INVALID_TOKEN` إن لم يوجد/انتهى/استُعمل، ثم `isConfirmed = true` ومسح التوكن ثم الإيقاف
- [ ] `getReports(filters)`: confirmed فقط، `populate` للحملة والمعلن والمُبلِّغ، و`pendingReportsForCampaign` لكل عنصر
- [ ] `getReportById(id)`: مع `otherReports` وبيانات الحملة (`remainingBudget`, `materials`)
- [ ] `getReportStatistics()` (aggregation): الإجماليات، `suspendedCampaigns`، `averageReviewTimeHours` (`$avg` على `reviewedAt - createdAt`)، `byReason`
- [ ] `reviewReport(reportId, adminId, { action, note })` داخل transaction:
  - `REPORT_ALREADY_REVIEWED` إن لم يكن `PENDING`
  - **`CONFIRM_VIOLATION`:** الحملة `status = CANCELLED` (تحقق `isCancellable`)، **استدعاء `releaseCampaignBudget(campaignId, session)`**، إغلاق كل البلاغات المعلقة للحملة كـ `RESOLVED` (`actionTaken = CAMPAIGN_CANCELLED`)، سجل `CANCELLED_BY_REPORT` يتضمن `releasedAmount`
  - **`DISMISS`:** `DISMISSED`؛ إن لم يبقَ بلاغ `PENDING` آخر على الحملة: `isSuspended = false` + `SUSPENSION_LIFTED` وإلا يبقى الإيقاف
  - بعد الـ commit: إشعارات وبريد (المعلن، ومقدمو البلاغات: المسجّل إشعار + بريد، والزائر بريد فقط)

#### A-04: Controller + Routes
- [ ] `report.controller.js`: يستجيب `201` للمسجّل و`202` للزائر (§5.1)
- [ ] ملء `report.routes.js` بالترتيب: `POST /campaigns/:campaignId/report` (`optionalAuth` + rate limiter + validate)، `POST /reports/confirm`، `GET /reports/statistics`، `GET /reports`، `GET /reports/:id`، `PUT /reports/:id` (الأدمن بـ `protect + adminOnly`)

### المرحلة A3: مراجعة المتقدمين — جانب المعلن (R2.04) — **High**

#### A-05: `applicationReview.*`
- [ ] `src/validators/application/applicationReview.validator.js` (Joi): params (`campaignId`, `id` ObjectId)، query (`status`: `PENDING` افتراضي | `ACCEPTED` | `REJECTED` | `ALL`، `page`, `perPage`)، body (`status`: `ACCEPTED | REJECTED`)
- [ ] `src/services/application/applicationReview.service.js`:
  - `getCampaignApplications(campaignId, filters)`: الأحدث أولاً، مع بيانات المبدع (`id, fullName, profilePicture, country, city, bio`) كما في العقد §4.5
  - `updateApplicationStatus(applicationId, advertiserId, status)`:
    - الطلب غير موجود → `NOT_FOUND`؛ الحملة ليست للمعلن → `FORBIDDEN`
    - الطلب ليس `PENDING` → `APPLICATION_ALREADY_REVIEWED`
    - **القبول** على حملة `CANCELLED` أو موقوفة (`isSuspended`) → `CAMPAIGN_UNAVAILABLE`
    - القبول: `$inc: { 'stats.totalCreators': 1 }`
    - الرفض: `$inc: { applicantsCount: -1 }` **مع الشرط** `applicantsCount > 0` (القسم 1.4)
    - تعبئة `reviewedAt` و`reviewedBy` داخل transaction مع تحديث العدادات
    - بعد الـ commit: `APPLICATION_ACCEPTED` / `APPLICATION_REJECTED` (إشعار + بريد للمبدع)
- [ ] `src/controllers/application/applicationReview.controller.js` (handlers: قائمة المتقدمين، تحديث الحالة)
- [ ] إضافة المسارين في قسم A من `application.routes.js` (القسم 1.2):
  - `GET /campaigns/:campaignId/applications` ← `protect + requireBrandRole + verifyCampaignOwnership`
  - `PUT /applications/:id/status` ← `protect + requireBrandRole` (الملكية داخل الخدمة)

### المرحلة A4: الـ hooks في الأجزاء الموجودة

#### A-06: إشعار من فضّلوا الحملة
- [ ] `src/services/creator/favoriteNotifications.service.js`: `notifyFavoritersCampaignUnavailable(campaignId, campaignName, reason)` ← `Favorite.find({ campaignId })` ثم `createManyNotifications` (داخل التطبيق فقط، بـ `data: { campaignId, favoriteId, reason }`). `reason`: `BUDGET_EXHAUSTED | ENDED | NOT_AVAILABLE`
- [ ] استدعاؤها (داخل `try/catch` وبعد التحديث، ولمرة واحدة عند الانتقال من متاح إلى غير متاح) من:
  - `budgetMonitor.job.js` (`BUDGET_EXHAUSTED`) **+ إشعار `BUDGET_EXHAUSTED` الداخلي للمعلن** (يغلق نقص سبرنت 3)
  - `campaignExpiry.job.js` (`ENDED`)
  - `pauseCampaign` في `campaignBudget.service.js` (`NOT_AVAILABLE`)
  - `suspendCampaignForReport` وإلغاء الحملة (`NOT_AVAILABLE`)

### المرحلة A5: المفضلة (R2.06) — **Medium**

#### A-07: المفضلة (انتقلت من B)
- [ ] `src/validators/creator/favorite.validator.js` (Joi): إضافة (`campaignId`)، قائمة (`sort`: `newest|oldest|highestCpm`، `availability`: `ALL|AVAILABLE|UNAVAILABLE`، `contentType`، pagination)، حذف جماعي (`ids`: 1–100 ObjectId)
- [ ] `src/services/creator/favorite.service.js`:
  - `addFavorite(creatorId, campaignId)`: idempotent (التقط `11000`)، الحملة يجب أن تكون `isPubliclyVisible` وإلا `NOT_FOUND`، يرجع `alreadyExisted`
  - `getFavorites(creatorId, filters)`: فرز وفلترة، و`availability` و`unavailableReason` (`BUDGET_EXHAUSTED | ENDED | NOT_AVAILABLE`) عبر `getAvailability`؛ الحملات غير الظاهرة تُعرض `UNAVAILABLE` بحقول محدودة (بدون `remainingBudget` و`targetCountries`)
  - `removeFavorite(id, creatorId)`: يخص المستخدم وإلا `NOT_FOUND`
  - `bulkRemoveFavorites(ids, creatorId)`: يتجاهل ما لا يخص المستخدم ويرجع `deleted`
- [ ] `favorite.controller.js` وملء `favorite.routes.js` (يحق `router.use(protect, requireClipperRole)`) بالترتيب: `POST /`, `GET /`, `POST /bulk-delete`, `DELETE /:id`

### المرحلة A6: ملكية الجودة

#### A-08: إصلاح `freeBalance.utils.js`
- [ ] في `src/utils/wallet/freeBalance.utils.js` استبدل `Math.max(0, wallet.balance - reservedBalance)` بـ `Math.max(0, wallet.balance)` (الميزانيات المخصصة خُصمت من الرصيد أصلاً؛ أبقِ `reservedBalance` للعرض فقط)
- [ ] راجع `walletRefund.service.js` (هل فيه شرط `ACTIVE_CAMPAIGN_EXISTS` مستقل؟) وحدّث اختبارات الاسترداد المتأثرة
- [ ] commit منفصل عن بقية سبرنت 4

#### A-09: اختبارات الجزء الخاص بـ A
- [ ] بلاغ مسجّل → الحملة `isSuspended` وتظهر `isSuspended` للمعلن (واختفاؤها من discover يُختبر بعد جاهزية عمل B)
- [ ] بلاغ مكرر → `409 ALREADY_REPORTED`، والمعلن على حملته → `403`
- [ ] زائر: لا إيقاف قبل التأكيد، `INVALID_TOKEN` لتوكن منتهٍ/مستعمل، والإيقاف بعد التأكيد
- [ ] بلاغان على حملة: رفض الأول يبقيها موقوفة، رفض الثاني يرفع الإيقاف
- [ ] تأكيد مخالفة: `CANCELLED` + الرصيد المتبقي عاد للمحفظة (`transactions` فيها `CREDIT`) + إغلاق البلاغات الأخرى
- [ ] حملة غير مموّلة (`walletId` فارغة): `budgetReleased: null`
- [ ] المعلن لا يستطيع `resume` حملة موقوفة (`CAMPAIGN_SUSPENDED`) ولا ملغاة
- [ ] غير الأدمن على `/reports` → `403`، والإشعارات: مستخدم لا يقرأ إشعار غيره (`404`)
- [ ] اختبار rate limit للبلاغات
- [ ] قبول/رفض من معلن لا يملك الحملة → `403`، وقبول طلب مراجَع سابقاً → `APPLICATION_ALREADY_REVIEWED`، والقبول على حملة ملغاة → `CAMPAIGN_UNAVAILABLE`، والرفض لا ينزل `applicantsCount` تحت الصفر
- [ ] المفضلة: idempotent، حذف جماعي لا يمسّ مفضلة غيرك، حملة صارت غير متاحة تظهر `UNAVAILABLE`

#### A-10: اختبارات التكامل بين الميزات (بعد جاهزية عمل B)
- [ ] 1: بلاغ → إيقاف → اختفاء من discover → رفض البلاغ → عودة الظهور
- [ ] 2: تقديم → قبول → تنزيل المواد → إشعارات الطرفين
- [ ] 3: مفضلة → نفاد الميزانية (شغّل `budgetMonitor` يدوياً) → إشعار للمبدع وللمعلن
- [ ] 4: تأكيد مخالفة → إلغاء → رصيد المحفظة زاد بالمتبقي

---

## 👤 الشخص B — الاكتشاف والتقديم والتفضيلات والتوصيات

### المرحلة B1: الاكتشاف والتفاصيل (R2.01, R2.02) — **High**

#### B-01: أدوات
- [ ] `src/utils/campaign/materialPreview.utils.js`: `buildPreviewUrl(material)` — يحقن تحويل Cloudinary في الرابط بعد `/upload/` (صورة: عرض مصغّر + جودة منخفضة + علامة مائية نصية، فيديو: دقة منخفضة + اقتطاع أول ~15 ثانية)، ويرجع `null` للصوت وPDF وغيرها. **لا يُرجَع `fileUrl` الأصلي لغير المقبولين أبداً**
- [ ] `src/validators/campaign/campaignDiscovery.validator.js` (Joi): `search` (≤100)، `contentType`، `countries` (قائمة مفصولة بفواصل، تُحوَّل لمصفوفة alpha-3 عبر `normalizeCountryList`)، `minCpm/maxCpm`، `sort` (`DISCOVER_SORT`)، pagination (افتراضي 20 وحد أقصى 50)

#### B-02: `src/services/campaign/campaignDiscovery.service.js`
- [ ] `buildDiscoverQuery(filters)` = `buildVisibleCampaignFilter()` + `contentType` (يطابق `contentType` **أو** `subCategories`) + `targetCountries: { $in }` + نطاق CPM
- [ ] البحث: regex مُهرَّب (escape) على اسم الحملة، + معلنون (`role: 'BRAND'`) بـ `fullName` مطابق → `advertiserId: { $in }`
- [ ] `getDiscoverCampaigns(creator, filters)`:
  - `find().lean()` مع projection يستثني `materials` و`brief` في القائمة
  - `endingSoon`: aggregation مع `$ifNull` على `endDate` (الـ null آخراً)
  - `bestMatch`: يعود إلى `newest` مؤقتاً حتى تكتمل B3 (ثم يستعمل `matchScore.utils.js`)
  - إثراء الصفحة كلها باستعلامين فقط (`$in`): `isFavorited` (قراءة من موديل `Favorite`) و`applicationStatus` (WITHDRAWN → `null`)
  - `availability` و`unavailableReason` عبر `getAvailability`
- [ ] `getSuggestions(q)`: حتى 8 (حملات ثم معلنون)
- [ ] `getCampaignDetails(campaignId, creator)`: `NOT_FOUND` إن لم تكن `isPubliclyVisible`، وحساب `canApply` و`applyBlockedReason`، و`materials` بـ `previewUrl` فقط، و`canDownloadMaterials`، و`favoriteId`
- [ ] `checkApplicantRequirements(campaign, creator)`: يرجع "مؤهل" إذا غابت بيانات المبدع (غير مفروض الآن، §8 في العقد)

#### B-03: Controller + Routes
- [ ] `campaignDiscovery.controller.js` وملء `campaignDiscovery.routes.js` (كل route بـ `protect + requireClipperRole + validate`) بالترتيب المذكور في الملف
- [ ] تأكد أن `GET /campaigns/discover` يعمل لمبدع بدون 403 (اختبار الترتيب في `app.js`)

### المرحلة B2: التقديم — جانب المبدع (R2.04) — **High**

#### B-04: `src/services/application/application.service.js`
- [ ] `applyToCampaign(creator, campaignId, { message })` داخل transaction:
  - الحملة غير ظاهرة/غير `isOpenForApplications` → `CAMPAIGN_UNAVAILABLE` (رسالة موحّدة، بدون كشف السبب)
  - `checkApplicantRequirements` → `REQUIREMENTS_NOT_MET`
  - طلب موجود: `WITHDRAWN` يُعاد استخدامه (`PENDING` + `appliedAt` جديد + `withdrawnAt = null`)، وغيره → `ALREADY_APPLIED`
  - حد المتقدمين ذرّياً: `Campaign.findOneAndUpdate({ _id, $or: [{ maxApplicants: null }, { $expr: { $lt: ['$applicantsCount', '$maxApplicants'] } }] }, { $inc: { applicantsCount: 1 } })` وإن لم يطابق → `APPLICANT_LIMIT_REACHED` (وتراجع الـ transaction)
  - بعد الـ commit: `NEW_APPLICANT` (إشعار + بريد للمعلن)
- [ ] `withdrawApplication(id, creatorId)`: `PENDING` فقط (`APPLICATION_NOT_WITHDRAWABLE`) + `$inc applicantsCount -1` بشرط `> 0` (القسم 1.4)
- [ ] `getMyApplications(creatorId, filters)`: الافتراضي يستثني `WITHDRAWN`
- [ ] `getAcceptedMaterials(id, creatorId)`: `ACCEPTED` فقط وإلا `FORBIDDEN`، والحملة غير ملغاة/موقوفة

#### B-05: Validators + Controller + Routes
- [ ] `application.validator.js` (Joi) و`application.controller.js`
- [ ] مسارات المبدع في `application.routes.js` (القسم العلوي): `POST /campaigns/:campaignId/apply`، `GET /applications/my`، `GET /applications/:id/materials`، `DELETE /applications/:id`

### المرحلة B3: التفضيلات والتوصيات (R2.05) — **Medium**

#### B-06: التفضيلات والتوصيات
- [ ] `src/validators/creator/creatorPreferences.validator.js` (Joi)، `creatorPreferences.service.js`: `get` (افتراضيات إن لم توجد)، و`upsert` (alpha-2 يُحوَّل إلى alpha-3)، و controller + ملء `creatorPreferences.routes.js` (يحق `router.use(protect, requireClipperRole)`)
- [ ] `src/utils/campaign/matchScore.utils.js`: دالة تقييم واحدة (تطابق الدولة، نوع المحتوى، `cpm ≥ minCpm`، أنواع محتوى تقديماته السابقة) تُرجع `{ score, reasons }` بالرموز في العقد §2.1
- [ ] `campaignRecommendation.service.js` + `GET /campaigns/recommendations` (تستثني ما قدّم عليه المبدع، و`meta.hasPreferences`)
- [ ] تفعيل `sort=bestMatch` في Discover بنفس دالة التقييم

### المرحلة B4: الاختبار والتوثيق

#### B-07: اختبارات الجزء الخاص بـ B
- [ ] مبدع على `/campaigns/discover` ينجح، وبراند `403`، وبدون توكن `401`
- [ ] الفلاتر والفرز كلها، `endingSoon` مع حملات بلا `endDate`، البحث باسم المعلن
- [ ] لا تظهر: حملة موقوفة بسبب بلاغ، `MANUALLY_PAUSED`، غير مموّلة، منتهية، مؤرشفة. وتظهر `Unavailable` عند `BUDGET_EXHAUSTED`
- [ ] `details` لا تُرجع `fileUrl` الأصلي، و`/materials` يعمل بعد القبول فقط
- [ ] التقديم: التكرار، حد المتقدمين مع **طلبات متزامنة** (`Promise.all` على عدة مبدعين)، السحب ثم إعادة التقديم، وبعد الرفض ممنوع
- [ ] التوصيات: مع/بدون تفضيلات، وتتغير عند تحديث التفضيلات

#### B-08: التوثيق
- [ ] Postman collection لكل endpoints السبرنت (للشخصين)
- [ ] مطابقة `API_CONTRACT_Sprint4.md` بالسلوك الفعلي وتحديث أي فرق (بالاتفاق مع A)

---

## 🤝 المهام المشتركة (بعد انتهاء A و B)

- [ ] مراجعة متبادلة (القسم 1.6)
- [ ] تشغيل `migrateSprint4.js` على قاعدة الإنتاج قبل نشر السبرنت (A)
- [ ] تأكد أن الفهارس الجديدة اكتمل بناؤها على قاعدة البيانات
- [ ] دمج `feature/s4-moderation` و`feature/s4-discovery` في `develop` ثم اختبار نهائي على Render

---

## ⛓️ الاعتماديات والتسليمات بين الشخصين

| من | إلى | ماذا |
|---|---|---|
| Gate (مشترك) | A و B | models، `notification.service`، قوالب الإشعارات، `campaignVisibility`، `errors`، `releaseCampaignBudget`، routers الفارغة |
| B (B-04 `apply`) | A (A-05، A-09 اختبار المراجعة) | لإنشاء طلبات حقيقية للاختبار (يمكن لـ A إنشاؤها يدوياً في الداتا بيز حتى تجهز) |
| B (B-03 `discover`) | A (A-09، A-10) | لاختبار اختفاء الحملة الموقوفة وتكامل المفضلة |
| A (A-07 المفضلة) | B (B-07) | اختبار `isFavorited` (يمكن لـ B إنشاء مستند `Favorite` يدوياً حتى تجهز) |
| B (B-06) | B (B-03) | `bestMatch` يتفعّل بعد `matchScore.utils.js` |

> لا يوجد انتظار حرج بين الشخصين: كل تسليم مشترك أُنجز في الـ Gate، وما بعده يمكن تجاوزه بإنشاء بيانات اختبار يدوياً.

---

## 📊 تقدير الحجم (تقريبي)

| | A | B |
|---|---|---|
| Endpoints | 16 (إشعارات 4، بلاغات 6، مراجعة المتقدمين 2، مفضلة 4) | 10 (اكتشاف 3، تقديم 4، تفضيلات 2، توصيات 1) |
| الثقل | عالٍ في الدقة: المال، transactions، الإيقاف والإلغاء، حماية الإساءة | عالٍ في الاستعلامات: بحث متعدد الحقول، aggregation، التزامن |
| الأولويات | البلاغات والتقديم (High) أولاً، المفضلة (Medium) في الآخر | الاكتشاف والتقديم (High) أولاً، التوصيات (Medium) في الآخر |

> إن ضاق الوقت يُؤجَّل من A: المفضلة (A-07) ثم `GET /reports/statistics`. ويُؤجَّل من B: التوصيات و`bestMatch`.

---

## ✅ تعريف الإنجاز (Definition of Done)
- [ ] كل endpoint يطابق `API_CONTRACT_Sprint4.md` (الشكل والأكواد)
- [ ] الصلاحيات مختبرة (`401` / `403` / ملكية الموارد)
- [ ] الاختبارات التلقائية تنجح، ولا كسر لاختبارات سبرنت 2 و3
- [ ] لا تغيير في ملف مشترك دون commit مستقل وإبلاغ الآخر
- [ ] الفرع مدموج في `develop` بعد مراجعة الآخر