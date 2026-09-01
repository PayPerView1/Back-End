و هي خطة للشخص الاول و التاني Tasks + sub tasks:

خطة العمل الكاملة — Sprint 2

المدة: 10 أيام عمل (Aug 11 → Aug 22)
ملاحظة: الأيام 1-2 مشتركة — الشخص الأول يُنجز الملفات المشتركة قبل أن يبدأ الثاني

👤 الشخص الأول — Creation Pipeline
🔴 المرحلة 1: الأساس المشترك (Day 1-2) — أولوية قصوى

هذه المهام يجب إنجازها أولاً لأن الشخص الثاني يعتمد عليها

Task 1.1 — إعداد الـ Constants والـ Models
 1.1.1 مراجعة وتأكيد campaign.constants.js مع الشخص الثاني قبل أي شيء
 1.1.2 كتابة Campaign.js model كاملاً (كل الـ sub-schemas)
 1.1.3 كتابة CampaignDraft.js model كاملاً
 1.1.4 كتابة CampaignActivityLog.js model كاملاً
 1.1.5 اختبار الـ models محلياً (إنشاء document تجريبي لكل model)
Task 1.2 — الملفات المشتركة (يُنجزها ويُبلّغ الشخص الثاني)
 1.2.1 كتابة campaignStatus.utils.js كاملاً
ALLOWED_TRANSITIONS object
DELETABLE_STATUSES array
ARCHIVABLE_STATUSES array
isTransitionAllowed() function
isDeletable() function
isArchivable() function
 1.2.2 كتابة activityLog.service.js كاملاً
logActivity(campaignId, action, performedBy, metadata) function
التحقق من صحة الـ action قبل الحفظ
معالجة الأخطاء بدون رمي exception (log فقط)
 1.2.3 كتابة campaignValidationMiddleware.js
verifyCampaignOwnership middleware
verifyDraftOwnership middleware
requireBrandRole middleware
 1.2.4 إشعار الشخص الثاني بانتهاء هذه الملفات ✅
🟡 المرحلة 2: File Upload Service (Day 2-3)
Task 2.1 — fileUpload.service.js
 2.1.1 إعداد multer مع memory storage
 2.1.2 كتابة validateFileType(file) — التحقق من الـ MIME type
المسموحات: video/mp4, image/jpeg, image/png, application/pdf, audio/mpeg, image/svg+xml
 2.1.3 كتابة validateFileSize(file) — الحد الأقصى 20MB
 2.1.4 كتابة validateFilesCount(files) — الحد الأقصى 10 ملفات
 2.1.5 كتابة uploadFilesToStorage(files) — رفع الملفات للـ cloud storage
توليد اسم فريد لكل ملف (UUID + timestamp)
إرجاع مصفوفة من { fileName, fileUrl, fileType, fileSizeKb, mimeType }
 2.1.6 كتابة deleteFilesFromStorage(fileUrls) — حذف الملفات عند حذف الحملة
 2.1.7 كتابة determineFileType(mimeType) — تحويل MIME إلى MATERIAL_TYPE enum
 2.1.8 اختبار الرفع والحذف محلياً
🟡 المرحلة 3: Campaign Validators (Day 3)
Task 3.1 — campaignCreation.validator.js
 3.1.1 validateCampaignCreation — للـ POST /campaigns
name: مطلوب، max 255 حرف
contentType: مطلوب، من الـ ENUM
category: مطلوب، من الـ ENUM
subCategories: مطلوبة إذا كان contentType = MIXED، وكل قيمة من الـ ENUM
totalBudget: مطلوب، رقم موجب
cpm: مطلوب، رقم موجب
dailyBudgetLimit: اختياري، رقم موجب إذا موجود
brief.mainIdea: مطلوب
targetCountries: مطلوب، مصفوفة غير فارغة، كل عنصر 3 أحرف (ISO)
halalDeclaration: مطلوب، كل الحقول الستة true
 3.1.2 validateHalalDeclaration — للتحقق من إعلان الحلال بشكل منفصل
التحقق من وجود الـ 6 checkboxes
التحقق من أن كلها true
Task 3.2 — campaignDraft.validator.js
 3.2.1 validateDraftCreation — للـ POST /campaigns/drafts
name: مطلوب فقط، max 255 حرف
 3.2.2 validateDraftUpdate — للـ PUT /campaigns/drafts/:id
كل الحقول اختيارية
التحقق من أنواع البيانات إذا موجودة
 3.2.3 validateDraftSubmission — للـ POST /campaigns/drafts/:id/submit
التحقق من اكتمال جميع الحقول المطلوبة كما في validateCampaignCreation
إرجاع قائمة بالحقول الناقصة
🟠 المرحلة 4: AI Review Service (Day 3-4)
Task 4.1 — aiReview.service.js
 4.1.1 كتابة reviewCampaign(campaign) — الدالة الرئيسية
استدعاء الـ AI microservice (Python/FastAPI)
إرجاع { result, score, feedback }
 4.1.2 كتابة buildReviewPayload(campaign) — تجهيز البيانات للـ AI
اسم الحملة + brief + targetCountries + halalDeclaration
 4.1.3 كتابة mapAIResultToStatus(aiResult) — تحويل نتيجة الـ AI إلى campaign status
APPROVED → ACTIVE
REJECTED → REJECTED
MANUAL_REVIEW_REQUIRED → MANUAL_REVIEW
 4.1.4 كتابة handleAIServiceFailure(campaign) — في حالة فشل الـ AI
تحويل الحملة إلى MANUAL_REVIEW تلقائياً
تسجيل الخطأ في الـ log
 4.1.5 اختبار الاستدعاء مع mock response (لأن الـ AI microservice قد لا يكون جاهزاً)
🟠 المرحلة 5: Campaign Creation Service (Day 4-5)
Task 5.1 — campaignCreation.service.js
 5.1.1 كتابة createCampaign(advertiserId, campaignData, files)
رفع الملفات عبر fileUpload.service.js
إنشاء campaign document
ضبط remainingBudget = totalBudget
تسجيل CREATED في الـ activity log
 5.1.2 كتابة submitCampaignForReview(campaign)
تغيير status إلى PENDING_REVIEW
ضبط submittedAt = now()
تسجيل SUBMITTED في الـ activity log
استدعاء aiReview.service.js
 5.1.3 كتابة processAIReviewResult(campaign, aiResult)
تحديث aiReview في الـ campaign
تغيير الـ status بناءً على نتيجة الـ AI
ضبط activatedAt إذا approved
تسجيل النتيجة في الـ activity log
 5.1.4 التأكد من أن كل عملية داخل try/catch مع rollback للملفات إذا فشل الحفظ
Task 5.2 — campaignCreation.controller.js
 5.2.1 كتابة createCampaign controller
استدعاء الـ validator
استدعاء الـ service
إرجاع الـ response الصحيح
 5.2.2 كتابة getAIReviewResult controller
جلب الحملة
إرجاع aiReview object
Task 5.3 — campaignCreation.routes.js
 5.3.1 ربط POST /api/v1/campaigns مع الـ middleware والـ controller
 5.3.2 ربط GET /api/v1/campaigns/:campaignId/ai-review
 5.3.3 إضافة protect و requireBrandRole و upload middleware لكل route
🟢 المرحلة 6: Campaign Draft Service (Day 5-6)
Task 6.1 — campaignDraft.service.js
 6.1.1 كتابة createDraft(advertiserId, draftData)
إنشاء draft document
ضبط expiresAt = now() + 30 days
version = 1
 6.1.2 كتابة getDraftById(draftId, advertiserId)
التحقق من الـ ownership
إرجاع الـ draft كاملاً
 6.1.3 كتابة updateDraft(draftId, advertiserId, updateData)
التحقق من أن الـ draft ليس EXPIRED
تحديث الحقول
زيادة الـ version بمقدار 1
تحديث lastSavedAt
 6.1.4 كتابة autoSaveDraft(draftId, advertiserId, updateData, clientVersion)
التحقق من الـ version (conflict detection)
إذا clientVersion < currentVersion → إرجاع 409
تحديث الـ draft وزيادة الـ version
 6.1.5 كتابة deleteDraft(draftId, advertiserId)
التحقق من الـ ownership
حذف الملفات المرفقة من الـ storage
حذف الـ draft
 6.1.6 كتابة submitDraft(draftId, advertiserId)
جلب الـ draft
التحقق من اكتمال البيانات عبر validateDraftSubmission
إنشاء campaign من بيانات الـ draft
استدعاء submitCampaignForReview
حذف الـ draft بعد النجاح
 6.1.7 كتابة expireDrafts() — للـ cron job
البحث عن drafts انتهت صلاحيتها (expiresAt < now() و status = DRAFT)
تغيير status إلى EXPIRED
إرسال إشعار للمعلن (email)
Task 6.2 — campaignDraft.controller.js
 6.2.1 كتابة createDraft controller
 6.2.2 كتابة getDraft controller
 6.2.3 كتابة updateDraft controller
 6.2.4 كتابة deleteDraft controller
 6.2.5 كتابة autoSaveDraft controller
 6.2.6 كتابة submitDraft controller
Task 6.3 — campaignDraft.routes.js
 6.3.1 ربط POST /api/v1/campaigns/drafts
 6.3.2 ربط GET /api/v1/campaigns/drafts/:draftId
 6.3.3 ربط PUT /api/v1/campaigns/drafts/:draftId
 6.3.4 ربط DELETE /api/v1/campaigns/drafts/:draftId
 6.3.5 ربط PATCH /api/v1/campaigns/drafts/:draftId/auto-save
 6.3.6 ربط POST /api/v1/campaigns/drafts/:draftId/submit
 6.3.7 إضافة middleware المناسب لكل route
🔵 المرحلة 7: Cron Job (Day 6)
Task 7.1 — إعداد Draft Auto-Expiry Job
 7.1.1 تثبيت node-cron أو استخدام بديل
 7.1.2 إنشاء src/jobs/draftExpiry.job.js
جدولة التشغيل يومياً (مثلاً: كل منتصف ليل)
استدعاء expireDrafts() من الـ service
 7.1.3 تسجيل الـ job في app.js أو server.js
 7.1.4 اختبار الـ job يدوياً بتغيير الـ date مؤقتاً
🧪 المرحلة 8: Testing — الشخص الأول (Day 7-8)
Task 8.1 — اختبار Campaign Creation
 8.1.1 اختبار POST /api/v1/campaigns — happy path
 8.1.2 اختبار validation errors (حقول مفقودة، MIXED بدون subCategories)
 8.1.3 اختبار Halal declaration غير مكتملة
 8.1.4 اختبار رفع ملفات (صيغ ممنوعة، حجم كبير، أكثر من 10)
 8.1.5 اختبار AI review — approved scenario (mock)
 8.1.6 اختبار AI review — rejected scenario (mock)
 8.1.7 اختبار AI review — manual review scenario (mock)
 8.1.8 اختبار AI service failure → تحويل لـ MANUAL_REVIEW
Task 8.2 — اختبار Draft Pipeline
 8.2.1 اختبار POST /api/v1/campaigns/drafts — بدون name → 400
 8.2.2 اختبار POST /api/v1/campaigns/drafts — happy path
 8.2.3 اختبار GET /api/v1/campaigns/drafts/:id — ownership check
 8.2.4 اختبار PUT /api/v1/campaigns/drafts/:id — تحديث ناجح
 8.2.5 اختبار PUT /api/v1/campaigns/drafts/:id — draft منتهية → 400
 8.2.6 اختبار PATCH auto-save — version conflict → 409
 8.2.7 اختبار DELETE — حذف مسودة
 8.2.8 اختبار POST /submit — draft غير مكتملة → أخطاء محددة
 8.2.9 اختبار POST /submit — draft مكتملة → campaign created
👤 الشخص الثاني — Management Pipeline

⚠️ لا تبدأ المرحلة 2 إلا بعد إشعار الشخص الأول بانتهاء المرحلة 1

🔴 المرحلة 1: الانتظار والتحضير (Day 1-2)
Task 1.1 — مراجعة الملفات المشتركة
 1.1.1 مراجعة campaign.constants.js والاتفاق على أي تعديلات مع الشخص الأول
 1.1.2 قراءة Campaign.js model وفهم كل الحقول
 1.1.3 قراءة campaignStatus.utils.js وفهم كيفية الاستخدام
 1.1.4 قراءة activityLog.service.js وفهم signature الدالة
Task 1.2 — التحضير المسبق (يعمل بالتوازي مع انتظار الشخص الأول)
 1.2.1 كتابة pagination.utils.js
javascript
  // الدوال المطلوبة:
  buildPaginationOptions(query)   // → { skip, limit, page }
  buildPaginationResponse(total, page, limit) // → { currentPage, totalPages, ... }
 1.2.2 دراسة MongoDB aggregation (ستحتاجه في statistics)
 1.2.3 دراسة MongoDB text search (ستحتاجه في search)
🟡 المرحلة 2: Validators (Day 2-3)
Task 2.1 — campaignManagement.validator.js
 2.1.1 validateGetCampaigns — للـ query parameters
status: من الـ ENUM أو ALL
category: من الـ ENUM إذا موجود
dateFrom / dateTo: تواريخ صالحة، dateFrom < dateTo
sortBy: من ['createdAt', 'name', 'totalBudget']
sortOrder: من ['asc', 'desc']
page: رقم موجب
limit: رقم بين 1 و 50
isArchived: boolean
 2.1.2 validateCopyCampaign — للـ POST /campaigns/:id/copy
newName: اختياري، إذا موجود max 255 حرف
includeMaterials: boolean، default true
 2.1.3 validateBulkAction — للـ bulk-delete و bulk-archive
campaignIds: مصفوفة مطلوبة، غير فارغة
كل عنصر valid MongoDB ObjectId
Task 2.2 — campaignCategory.validator.js
 2.2.1 validateCategoryFilter — للـ GET /campaigns?category=
التحقق من أن القيمة من الـ ENUM
🟠 المرحلة 3: Campaign Management Service (Day 3-5)
Task 3.1 — campaignManagement.service.js

القسم أ — جلب الحملات:

 3.1.1 كتابة getCampaigns(advertiserId, filters)
بناء الـ MongoDB query من الـ filters
status filter: إذا ALL لا تضيف شرط، وإلا { status: filters.status }
category filter: { category: filters.category }
date filter: { createdAt: { $gte: dateFrom, $lte: dateTo } }
search filter: { $text: { $search: filters.search } } أو regex
isArchived filter: { isArchived: filters.isArchived }
advertiserId filter: دائماً مطلوب
الـ sort وفق sortBy و sortOrder
الـ pagination عبر pagination.utils.js
 3.1.2 كتابة buildCampaignQuery(advertiserId, filters) — دالة مساعدة
تجميع كل الـ filters في object واحد نظيف

القسم ب — تفاصيل حملة:

 3.1.3 كتابة getCampaignById(campaignId, advertiserId)
جلب الحملة مع التحقق من الـ ownership
جلب الـ activity log المرتبط بها من CampaignActivityLog
دمج الـ statusHistory مع الـ campaign data

القسم ج — نسخ حملة:

 3.1.4 كتابة copyCampaign(campaignId, advertiserId, options)
جلب الحملة الأصلية
بناء draft data من بيانات الحملة
name = options.newName || originalName + ' (Copy)'
copyInfo = { isCopy: true, copiedFromId: campaignId }
نسخ الـ materials إذا options.includeMaterials = true
زيادة copyCount في الحملة الأصلية
إنشاء draft جديد
تسجيل COPIED في الـ activity log

القسم د — أرشفة واستعادة:

 3.1.5 كتابة archiveCampaign(campaignId, advertiserId)
التحقق من isArchivable(campaign.status) عبر campaignStatus.utils.js
تحديث isArchived = true و archivedAt = now()
تسجيل ARCHIVED في الـ activity log
 3.1.6 كتابة restoreCampaign(campaignId, advertiserId)
التحقق من أن isArchived = true
تحديث isArchived = false و archivedAt = null
تسجيل RESTORED في الـ activity log

القسم هـ — حذف:

 3.1.7 كتابة deleteCampaign(campaignId, advertiserId)
التحقق من isDeletable(campaign.status) عبر campaignStatus.utils.js
حذف الملفات من الـ storage
حذف الـ campaign document
حذف الـ activity logs المرتبطة

القسم و — Bulk Actions:

 3.1.8 كتابة bulkDeleteCampaigns(campaignIds, advertiserId)
لكل campaign: التحقق من الـ ownership والـ deletable status
تجميع الناجحة والفاشلة
تنفيذ الحذف للناجحة
إرجاع { deleted, failed, failedIds }
 3.1.9 كتابة bulkArchiveCampaigns(campaignIds, advertiserId)
نفس المنطق مع أرشفة بدل حذف

القسم ز — Export:

 3.1.10 كتابة exportCampaignToCSV(campaignId, advertiserId)
جلب الحملة كاملة
تحويل البيانات إلى CSV format
الأعمدة: name, status, category, totalBudget, remainingBudget, cpm, totalViews, totalSpent, createdAt, activatedAt, completedAt

القسم ح — Statistics:

 3.1.11 كتابة getCampaignStatistics(advertiserId)
استخدام MongoDB aggregation
count per status
total budget spent
average CPM
count per category
🟢 المرحلة 4: Campaign Category Service (Day 4)
Task 4.1 — campaignCategory.service.js
 4.1.1 كتابة getAllCategories()
قراءة البيانات من CAMPAIGN_CATEGORIES في الـ constants
إرجاعها كاملة مع الـ subCategories
 4.1.2 كتابة getSubCategories()
إرجاع subCategories الخاصة بـ MIXED فقط
🟠 المرحلة 5: Controllers (Day 5-6)
Task 5.1 — campaignManagement.controller.js
 5.1.1 كتابة getCampaigns controller
استدعاء validateGetCampaigns
استدعاء getCampaigns service
إرجاع campaigns + pagination + summary
 5.1.2 كتابة getCampaignById controller
 5.1.3 كتابة copyCampaign controller
 5.1.4 كتابة archiveCampaign controller
 5.1.5 كتابة restoreCampaign controller
 5.1.6 كتابة deleteCampaign controller
 5.1.7 كتابة bulkDelete controller
 5.1.8 كتابة bulkArchive controller
 5.1.9 كتابة exportCampaign controller
ضبط الـ headers الصحيحة للـ CSV download
Content-Type: text/csv
Content-Disposition: attachment; filename="..."
 5.1.10 كتابة getStatistics controller
Task 5.2 — campaignCategory.controller.js
 5.2.1 كتابة getCategories controller
 5.2.2 كتابة getSubCategories controller
🔵 المرحلة 6: Routes (Day 6)
Task 6.1 — campaignManagement.routes.js

⚠️ تذكر: الـ routes الثابتة أولاً دائماً

 6.1.1 ربط GET /statistics — قبل أي شيء
 6.1.2 ربط POST /bulk-delete
 6.1.3 ربط POST /bulk-archive
 6.1.4 ربط GET / — قائمة الحملات
 6.1.5 ربط GET /:campaignId
 6.1.6 ربط POST /:campaignId/copy
 6.1.7 ربط PATCH /:campaignId/archive
 6.1.8 ربط PATCH /:campaignId/restore
 6.1.9 ربط DELETE /:campaignId
 6.1.10 ربط GET /:campaignId/export
 6.1.11 إضافة protect, requireBrandRole, verifyCampaignOwnership لكل route تحتاجه
Task 6.2 — campaignCategory.routes.js

⚠️ تذكر: الـ routes الثابتة أولاً

 6.2.1 ربط GET /categories — بدون authentication
 6.2.2 ربط GET /categories/sub-categories — بدون authentication
🧪 المرحلة 7: Testing — الشخص الثاني (Day 7-8)
Task 7.1 — اختبار Campaign List
 7.1.1 اختبار GET /api/v1/campaigns — بدون filters
 7.1.2 اختبار filter بالـ status
 7.1.3 اختبار filter بالـ category
 7.1.4 اختبار filter بالـ date range
 7.1.5 اختبار البحث بالاسم
 7.1.6 اختبار الـ sort (كل الخيارات)
 7.1.7 اختبار الـ pagination (page 1, page 2, last page)
 7.1.8 اختبار isArchived=true
 7.1.9 اختبار empty state (لا توجد حملات)
Task 7.2 — اختبار Campaign Details
 7.2.1 اختبار GET /:id — حملة موجودة
 7.2.2 اختبار GET /:id — ownership violation → 403
 7.2.3 اختبار GET /:id — not found → 404
 7.2.4 التحقق من وجود statusHistory في الـ response
Task 7.3 — اختبار Copy, Archive, Restore, Delete
 7.3.1 اختبار copy — مع newName مخصص
 7.3.2 اختبار copy — بدون newName → يضيف (Copy)
 7.3.3 اختبار copy — بدون materials
 7.3.4 اختبار archive — حملة COMPLETED → ينجح
 7.3.5 اختبار archive — حملة ACTIVE → 400
 7.3.6 اختبار restore — حملة مؤرشفة → ينجح
 7.3.7 اختبار restore — حملة غير مؤرشفة → 400
 7.3.8 اختبار delete — حملة DRAFT → ينجح
 7.3.9 اختبار delete — حملة ACTIVE → 400
Task 7.4 — اختبار Bulk, Export, Statistics
 7.4.1 اختبار bulk-delete — IDs صحيحة
 7.4.2 اختبار bulk-delete — IDs مختلطة (بعضها لا يمكن حذفه)
 7.4.3 اختبار bulk-archive — نفس المنطق
 7.4.4 اختبار export — التحقق من الـ CSV headers والـ content
 7.4.5 اختبار statistics — التحقق من صحة الأرقام
Task 7.5 — اختبار Categories
 7.5.1 اختبار GET /categories — بدون token
 7.5.2 اختبار GET /categories/sub-categories — بدون token
 7.5.3 التحقق من صحة البيانات المُرجَعة
🤝 المهام المشتركة (Day 8-9)
Task M.1 — ربط الـ Routes في app.js

يتفق الشخصان على من يضيفها — الأفضل أن يفعلها معاً

 M.1.1 إضافة campaign creation routes
 M.1.2 إضافة campaign draft routes
 M.1.3 إضافة campaign management routes
 M.1.4 إضافة campaign category routes
 M.1.5 التأكد من ترتيب الـ routes الصحيح
Task M.2 — Integration Testing (معاً)
 M.2.1 اختبار كامل: إنشاء حملة → قبول AI → جلبها في القائمة
 M.2.2 اختبار كامل: حفظ مسودة → تحديثها → submit → حملة جديدة
 M.2.3 اختبار كامل: نسخ حملة → تعديلها → submit
 M.2.4 اختبار كامل: أرشفة حملة → استعادتها
 M.2.5 اختبار الـ activity log — التحقق من تسجيل كل الأحداث