# مهام Sprint 5: مسارا العمل

**الحجم:** S ≈ نصف يوم أو أقل، M ≈ يوم إلى يومين، L ≈ ثلاثة إلى أربعة أيام. (تقديرات تقريبية لتوزيع الجهد، لا التزام.)

## قرارات مثبتة
1. **جلب بيانات المنشورات (oEmbed / YouTube) يتم في الباك إند.** أعيد النظر فيه فقط إن كان لدى مهندس الـ AI endpoint جاهز لذلك.
2. **عقد الـ AI مؤقت** (القسم 9 في `API_CONTRACT_Sprint5.md`). يعمل كل شيء على `AI_MOCK=true` إلى أن يؤكد مهندس الـ AI الشكل الفعلي. والتعديل عند التأكيد محصور في `aiSubmissionReview.client.js`.
3. **التقسيم عمودي بالمزايا:** كل مسار يملك ملفاته كاملة (route + controller + service + validator + اختبارات).
4. **أنجزنا الدفعتين 1 و2** (الأساسيات والهياكل المشتركة). المهام أدناه تبدأ بعدهما.

---

## الملكية

### نقاط التماس (متفق عليها قبل أي كود)
| # | نقطة التماس | تكتبها | تستعملها |
|---|---|---|---|
| T1 | `verifyPost({ creatorId, campaignId, platform, url, excludeSubmissionId?, skipLimitCheck? })` | أ | ب (`submit`, `updateLink`, `resubmit`) |
| T2 | `deleteDraft(creatorId, campaignId)` في `submissionDraft.service` | أ | ب (بعد `submit`) |
| T3 | `submissionDto`, `submissionNotifications`, `submissionGuards`, `hashtag.utils`, `submissionRules` | جاهزة (الدفعة 2) | الاثنان، ولا يعدّلها أحد دون اتفاق |

**شكل ما ترجعه `verifyPost`:**
```js
{
  campaign,            // lean: _id, name, advertiserId, brief, submissionRequirements, halalDeclaration, maxSubmissionsPerCreator, ...
  application,         // lean
  parsed,              // { platform, canonicalUrl, externalId }
  postMeta,            // شكل Submission.postMeta
  evaluation,          // ناتج evaluateRequirements: { checks, view, allMet, canSubmit, blocking, warnings, ... }
}
```
وترمي أخطاء العقد: `APPLICATION_NOT_ACCEPTED`, `CAMPAIGN_UNAVAILABLE`, `SUBMISSION_LIMIT_REACHED` (إلا مع `skipLimitCheck`), `UNSUPPORTED_PLATFORM`, `PLATFORM_MISMATCH`, `INVALID_LINK`, `POST_NOT_PUBLIC`, `LINK_ALREADY_SUBMITTED` (مع استثناء `excludeSubmissionId`). **لا ترمي** `CONTENT_REQUIREMENTS_NOT_MET`: تُرجع `evaluation.canSubmit` ويقرر المستدعي (`verify-link` يرجعها بـ 200 و`submit` يرمي الخطأ).

### ملفات كل مسار
| | المسار أ: تجهيز التسليم | المسار ب: دورة التسليم |
|---|---|---|
| routes | قسم "أ" في `submission.routes.js`، و`material.routes.js` | قسم "ب" في `submission.routes.js`، و`submissionAdmin.routes.js` |
| controllers | `submissionVerify`, `submissionEligibility`, `submissionDraft`, `materialDownload` | `submission`, `submissionReview` |
| services | `submissionVerify`, `submissionEligibility`, `submissionDraft`, `material/materialDownload`, مزودو `social/providers/*` | `submission`, `submissionProcessing`, `submissionReview` |
| validators | `material.validator`, **`submissionPrep.validator`** | `submission.validator`, `submissionReview.validator` |
| غير ذلك | `submissionRateLimiter`, `downloadToken.utils`, تعديل `application.service/controller` | `submissionProcessor.job`, `submissionAutoApprove.job` |
| اختبارات | `submissionVerify`, `submissionEligibility`, `submissionDraft`, `materialDownload`, `providers` | `submission`, `submissionProcessing`, `submissionReview` |

> ثلاثة ملفات جديدة لم تكن في شجرة الملفات: `submissionVerify.service.js` و`submissionVerify.controller.js` و`submissionPrep.validator.js` (لتجنب أن يتشارك الاثنان `submission.controller.js` و`submission.validator.js`).

### قواعد العمل
- فرع لكل مسار: `sprint-5/track-a` و`sprint-5/track-b`، يتفرعان من `sprint-5` بعد دمج الدفعتين.
- PR صغير لكل مهمة (A1، A2...)، ومراجعة متبادلة قبل الدمج.
- `submission.routes.js`: ملف واحد بقسمين مفصولين بتعليقات (`// ===== المسار أ =====`). لا تعدّل قسم الآخر.
- ما يظهر اختلاف عن العقد يُسجَّل في جدول "تعديلات على العقد" في آخر هذا الملف، ولا يُغيَّر بصمت.

---

# المسار أ: تجهيز التسليم

## A0. `verifyPost` (تُنجز أولاً، ويعتمد عليها المسار ب) — M
**ملف:** `services/submission/submissionVerify.service.js`

- [ ] **A0.1 (ساعة واحدة):** أنشئ الملف بنفس التوقيع يرجع **بيانات ثابتة** (stub) وادمجه فوراً حتى لا يتوقف المسار ب.
- [ ] A0.2 الترتيب: `getAcceptedApplication` ثم تحميل الحملة (الحقول اللازمة فقط) ثم `assertCampaignOpenForSubmissions` ثم `assertWithinSubmissionLimit` (إلا مع `skipLimitCheck`).
- [ ] A0.3 `isPlatformAllowed` ثم `resolveAndParse` ثم `fetchPostMetadata`.
- [ ] A0.4 تحويل `fetchStatus`: `NOT_FOUND` ⇒ `INVALID_LINK` مع `details.httpStatus = 404`، و`PRIVATE` ⇒ `POST_NOT_PUBLIC`، و`UNAVAILABLE` ⇒ متابعة.
- [ ] A0.5 فحص التكرار: `Submission.findOne({ dedupKey, linkLocked: true, _id: { $ne: excludeSubmissionId } })`. إن وُجد ⇒ `LINK_ALREADY_SUBMITTED`، و`details` فقط إن كان لنفس المبدع (`submissionId`, `code`, `campaignName`, `submittedAt`, `status`)، وإلا `details: null`.
- [ ] A0.6 `evaluateRequirements` وإرجاع الكائن المتفق عليه.

**معايير القبول:** اختبارات وحدة (مع `jest.mock` لـ `socialMetadata` و`linkParser`) تغطي: غير مقبول، حملة مغلقة، حد التسليمات، منصة غير مسموحة، رابط 404، منشور خاص، تكرار من نفس المبدع (مع details) ومن مبدع آخر (بدون details)، واستثناء `excludeSubmissionId`.

## A1. مزودو المنصات — M
**ملفات:** `providers/tiktok.provider.js`, `youtube.provider.js` (وإنستغرام يبقى stub)

- [ ] A1.1 **TikTok:** استدعاء oEmbed العام للرابط، وتحويل `title` ⇒ `caption`, `author_name`, `author_url` ⇒ `authorUrl` + `authorHandle` (من `/@name`), `thumbnail_url`. أخطاء 400/404 ⇒ `NOT_FOUND`.
- [ ] A1.2 **YouTube:** `videos.list` (`snippet`, `contentDetails`, `statistics`) بـ `YOUTUBE_API_KEY`. `caption = title + "\n" + description`, المدة من ISO-8601 إلى ثوانٍ، والإحصاءات `views/likes/comments`. `items` فارغة ⇒ `NOT_FOUND`. بدون مفتاح ⇒ `UNAVAILABLE` مع تحذير في الـ log.
- [ ] A1.3 اختبارات بـ `jest.mock('axios')` لكل حالة (نجاح، 404، مهلة، رد غريب).
- [ ] A1.4 **اختبار يدوي** بروابط حقيقية لكل منصة، **وقراءة التوثيق الحالي للمنصتين** قبل الاعتماد (شكل الردود وشروط الاستعمال قد يتغير).
- [ ] A1.5 اختبار يدوي لـ `resolveShortLink` برابط `vm.tiktok.com` حقيقي (لم يُختبر بعد).

**معايير القبول:** `fetchPostMetadata` ترجع `OK` وحقولاً كاملة لرابط تيك توك ويوتيوب حقيقيين، و`NOT_FOUND` لرابط محذوف، ولا تتعطل أبداً.

## A2. `verify-link` — M
**ملفات:** `submissionVerify.controller`, `submissionPrep.validator`, `submissionRateLimiter`, قسم أ في `submission.routes.js`

- [ ] A2.1 Joi: `campaignId` ObjectId، و`platform` من الـ enum، و`url` نص بطول ≤ 500.
- [ ] A2.2 الـ controller يستدعي `verifyPost` ويبني الاستجابة (`preview`, `requirements: evaluation.view`, `canSubmit`, `warnings`).
- [ ] A2.3 `submissionRateLimiter` (مثلاً 20 طلباً في الدقيقة لكل مستخدم، مرجعه `reportRateLimiter`).
- [ ] A2.4 المسار: `protect` + `requireClipperRole` + rate limit + validate.

**معايير القبول:** استجابة مطابقة للقسم 4.3 من العقد في الحالات: كل المتطلبات متوفرة، هاشتاق ناقص (`canSubmit:false`)، منشور غير مقروء (`found:null` + تحذير)، وأخطاء الرابط (غير صالح، منصة غير مدعومة، عدم تطابق، تكرار). اختبار supertest يغطيها.

## A3. الأهلية والمتطلبات — M
**ملفات:** `submissionEligibility.service/controller`

- [ ] A3.1 `GET /submissions/eligible-campaigns`: الطلبات `ACCEPTED` للمبدع ⇒ حملات (غير مؤرشفة/ملغاة/موقوفة/منتهية) ⇒ حساب `availability`, `unavailableReason`, `hoursLeft`, `badges`, `mySubmissions`.
- [ ] A3.2 التبويبات `ALL/READY/ENDING_SOON`، و`meta.counts` للثلاثة معاً، والبحث (اسم الحملة أو المعلن)، والترقيم.
- [ ] A3.3 `GET /campaigns/:campaignId/submission-requirements` مع `canSubmit` و`cannotSubmitReason`.
- [ ] A3.4 استعمل `buildRequirementsView` و`isOpenForSubmissions` و`getSubmissionLimit`، ولا تعد كتابتها.

**معايير القبول:** اختبارات: ثلاث حملات بحالات مختلفة تعطي أعداداً صحيحة للتبويبات؛ حملة موقوفة بسبب بلاغ لا تظهر؛ حملة ميزانيتها منتهية تظهر في `ALL` فقط؛ بلوغ حد التسليمات يعطي `SUBMISSION_LIMIT_REACHED` كسبب.

## A4. المسودات — S
**ملفات:** `submissionDraft.service/controller`

- [ ] A4.1 `PUT` (upsert بـ `findOneAndUpdate` وتجديد `expiresAt`) و`GET` (`data: null` عند عدم الوجود) و`DELETE`.
- [ ] A4.2 يتطلب طلباً مقبولاً (`getAcceptedApplication`).
- [ ] A4.3 **T2:** صدّر `deleteDraft(creatorId, campaignId)` للمسار ب.

**معايير القبول:** مسودتان لنفس المبدع/الحملة ⇒ سجل واحد؛ مبدع غير مقبول ⇒ `APPLICATION_NOT_ACCEPTED`؛ اختبار TTL غير مطلوب (يتكفل به MongoDB).

## A5. التنزيل — L
**ملفات:** `material/*` (routes/controller/service/validator)، `downloadToken.utils`، `application.service` + `application.controller`

- [ ] **A5.0 (أولاً، مستقلة، أولوية قصوى):** أعد تفعيل شرط `ACCEPTED` المعلّق في `getAcceptedMaterials` + منع الحملات الملغاة/المؤرشفة، في PR صغير منفصل يُدمج فوراً.
- [ ] A5.1 `downloadToken.utils`: JWT يحمل `logId` فقط، سرّه `DOWNLOAD_LINK_SECRET`، وصلاحيته `DOWNLOAD_LINK_TTL_SECONDS`.
- [ ] A5.2 `GET /applications/:id/materials` بالشكل الجديد (بدون `downloadUrl`، مع `summary` و`canDownloadAll`)، وأعد استعمال دالة المعاينة الموجودة (`materialPreview.utils`).
- [ ] A5.3 `POST .../download-link` و`.../download-all`: ينشئ `DownloadLog` (`REQUESTED`) لكل ملف، ويرجع الروابط بالشكل المتفق عليه.
- [ ] A5.4 `GET /materials/download/:token`: استهلاك ذري (`findOneAndUpdate` على `consumedAt: null` و`linkExpiresAt > now`)، إعادة التحقق من الطلب `ACCEPTED` والحملة، ثم `302` لرابط Cloudinary مع `fl_attachment`. أخطاء: `DOWNLOAD_LINK_EXPIRED` (410) و`FORBIDDEN`.
- [ ] A5.5 سجل نشاط `MATERIALS_DOWNLOADED` مرة واحدة لكل (مبدع، حملة).
- [ ] A5.6 `PATCH /downloads/:logId` (مرة واحدة، + إشعار `DOWNLOAD_COMPLETED/FAILED` عبر `notifyDownloadResult`).
- [ ] A5.7 `GET /campaigns/:campaignId/downloads` للمعلن (تجميع حسب المبدع).

**معايير القبول:** رابط يُستعمل مرتين ⇒ الثاني `410`؛ رابط منتهٍ ⇒ `410`؛ مبدع غير مقبول لا يحصل على رابط؛ بعد سحب القبول/إلغاء الحملة لا يعمل رابط قديم؛ المعلن لا يرى إلا حملته. اختبارات supertest للمسارات الستة.

## A6. حقول الحملة الجديدة في خدمات الحملات القديمة — M
**ملفات:** (Sprint 2) `campaignCreation` و`campaignDraft` و`campaignManagement` services وvalidators

- [ ] A6.1 قبول `submissionRequirements` و`maxSubmissionsPerCreator` في إنشاء الحملة والمسودة وتحديثها (Joi/express-validator حسب الموجود).
- [ ] A6.2 تنظيف القوائم بـ `toStoredList` (حذف `#`/`@`، تكرار، أطوال).
- [ ] A6.3 نقلها عند تحويل المسودة إلى حملة، وعند نسخ حملة (`copy`)، وإرجاعها في `GET /campaigns` و`GET /campaigns/:campaignId`.

**معايير القبول:** حملة تُنشأ بهاشتاقات `["#تمويل_إسلامي", "تمويل_إسلامي"]` تُخزَّن `["تمويل_إسلامي"]`؛ المسودة ثم الإرسال تحتفظ بالحقول؛ الحملات القديمة بدونها تعمل كما هي. **أحتاج رؤية هذه الملفات لمساعدتك** (أرسلها حين تصلين لها).

---

# المسار ب: دورة التسليم

## B1. إنشاء التسليم — L
**ملفات:** `submission.service` (`createSubmission`), `submission.controller`, `submission.validator`, قسم ب في `submission.routes.js`

- [ ] B1.1 Joi لـ `POST /campaigns/:campaignId/submissions` (`halalPledge` يجب أن تكون `true`).
- [ ] B1.2 **اعمل على `verifyPost` الـ stub (A0.1)** إلى أن يجهز الحقيقي، ولا تعد كتابة منطقه.
- [ ] B1.3 إن `!evaluation.canSubmit` ⇒ `CONTENT_REQUIREMENTS_NOT_MET` مع `details` (`missingHashtags`, `missingKeywords`, `missingMentions`, `duration`).
- [ ] B1.4 إنشاء المستند: `status: SUBMITTED`، و`postMeta`, `checks` (قواعد الباك)، و`hashtags` (المُدخلة من المبدع أو المستخرجة من الوصف)، و`keywords`, `notes`, `halalPledge`، و`reviewDeadlineAt = now + SUBMISSION_REVIEW_DEADLINE_HOURS`.
- [ ] B1.5 خطأ `E11000` من الفهرس الفريد ⇒ `LINK_ALREADY_SUBMITTED` (سباق بين طلبين متزامنين).
- [ ] B1.6 سباق حد التسليمات: بعد الإدراج أعد العدّ، وإن تجاوز الحد احذف المستند وارمِ `SUBMISSION_LIMIT_REACHED`.
- [ ] B1.7 سجل نشاط `SUBMISSION_RECEIVED`، واستدعاء `deleteDraft` (T2)، ثم إطلاق المعالجة دون انتظارها (`setImmediate(() => processSubmission(id))`)، والرد `201` بـ `toDetail`.

**معايير القبول:** مطابقة القسم 5.1 من العقد؛ تسليمان متزامنان لنفس الرابط ينجح أحدهما فقط؛ تسليم السادس يُرفض (والحد 5)؛ الرد فوري (لا ينتظر الـ AI).

## B2. القراءة — M
**ملفات:** `submission.service` (`getMySubmissions`, `getSubmissionById`)

- [ ] B2.1 `GET /submissions/my`: فلتر `displayStatus` (دالة `displayStatusToFilter` تحوّله لشرط على `status`/`aiReview`/`rejectedBy`/`adminReview`) و`campaignId`، والافتراضي يستثني `WITHDRAWN`، وpopulate للحملة والمعلن.
- [ ] B2.2 `GET /submissions/:id`: `toDetail`، و`404` لتسليم مبدع آخر.
- [ ] B2.3 **ترتيب المسارات:** الثابتة (`eligible-campaigns`, `verify-link`, `my`) قبل `/:id`.

**معايير القبول:** كل `displayStatus` يُرجع التسليمات الصحيحة فقط؛ لا ثغرة وصول لتسليمات الآخرين.

## B3. معالجة الـ AI والـ jobs — L
**ملفات:** `submissionProcessing.service`, `submissionProcessor.job`

- [ ] B3.1 `processSubmission(id)`: احجز القفل ذرياً (`status: SUBMITTED`, `aiReview.status: PENDING`, والقفل فارغ أو أقدم من 5 دقائق)، وزد `attempts`.
- [ ] B3.2 `buildReviewPayload` ثم `reviewSubmission`، وطبّق النتيجة بتحديث **شرطي** (`status` ما زال `SUBMITTED`) حتى لا تُكتب فوق تسليم سُحب.
- [ ] B3.3 `APPROVED`: ⇒ `UNDER_REVIEW`, `advertiserReview: PENDING`، ودمج `checks` (قواعد + AI) و`aiReview.score`. إشعارات: `notifyCreatorAiApproved` + `notifyBrandNewSubmission`.
- [ ] B3.4 `REJECTED`: ⇒ `REJECTED`, `rejectedBy: AI`, `rejectionReasons` من الفحوصات `FAILED` (سبب عام إن لم توجد)، و`linkLocked: false`. إشعار `notifyCreatorAiRejected`.
- [ ] B3.5 `MANUAL_REVIEW_REQUIRED`: ⇒ `UNDER_REVIEW`, `adminReview.queuedAt/reasonCode`. إشعارات: `notifyCreatorManualReview` + `notifyAdminsManualReview`.
- [ ] B3.6 فشل الاتصال أو رد غير صالح: سجّل `lastError`، وبعد `AI_MAX_ATTEMPTS` (3) ⇒ مراجعة يدوية بـ `reasonCode: AI_UNAVAILABLE`، قبلها اترك التسليم لإعادة المحاولة.
- [ ] B3.7 `recoverPendingSubmissions()` تلتقط العالقة، والـ job `*/2 * * * *` ويعمل مرة عند الإقلاع (استبدل الـ stub).

**معايير القبول:** اختبارات بـ `AI_MOCK`/`jest.mock` للحالات الثلاث + فشل الـ AI ثلاث مرات؛ تسليم سُحب أثناء المعالجة لا يتأثر بالنتيجة؛ تشغيل المعالجة مرتين متوازيتين لا يُنتج إشعارات مكررة.

## B4. السحب وتحديث الرابط وإعادة التسليم — M
**ملفات:** `submission.service`

- [ ] B4.1 `DELETE /submissions/:id`: تحديث شرطي (`SUBMITTED`، أو `UNDER_REVIEW` قبل قرار المعلن) ⇒ `WITHDRAWN`, `linkLocked: false`, `withdrawnAt`. وإلا `SUBMISSION_NOT_WITHDRAWABLE`.
- [ ] B4.2 `PUT /submissions/:id/link` (R2.12): `verifyPost` مع `excludeSubmissionId` و`skipLimitCheck`، وإضافة القديم لـ `linkHistory`، وإعادة التسليم لـ `SUBMITTED` (وتصفير قرار المعلن إن كان معتمداً)، وإعادة تشغيل المعالجة. مسموح فقط في `AWAITING_ADVERTISER` و`APPROVED`.
- [ ] B4.3 `POST /submissions/:id/resubmit`: يتطلب `AI_REJECTED`/`REJECTED`، وينسخ الحقول الناقصة، ويمر بنفس مسار `createSubmission` (`attempt + 1`, `resubmissionOf`).

**معايير القبول:** الرابط المسحوب يمكن تسليمه من جديد؛ تحديث الرابط لا يعتبره تكراراً لنفسه؛ لا يمكن إعادة تسليم تسليم نشط.

## B5. المراجعة (المعلن والأدمن) والاعتماد التلقائي — L
**ملفات:** `submissionReview.service/controller/validator`, `submissionAdmin.routes`, `submissionAutoApprove.job`

- [ ] B5.1 `GET /campaigns/:campaignId/submissions` للمعلن (مالك الحملة، بدون `PROCESSING`/`MANUAL_REVIEW`).
- [ ] B5.2 `PUT /submissions/:id/review` (المعلن): تحديث شرطي على `AWAITING_ADVERTISER`، و`APPROVE` ⇒ `APPROVED` + `stats.totalApprovedVideos` (+1 ذرياً) + `SUBMISSION_APPROVED` في سجل النشاط + إشعار؛ `REJECT` (ملاحظة إلزامية) ⇒ `REJECTED` بـ `rejectedBy: ADVERTISER` وتحرير الرابط.
- [ ] B5.3 `GET /admin/submissions/manual-review` (الأقدم أولاً) و`PUT /admin/submissions/:id/review`: `APPROVE` ⇒ مرحلة المعلن (وإشعار `NEW_SUBMISSION`)، و`REJECT` ⇒ `REJECTED` بـ `rejectedBy: ADMIN`.
- [ ] B5.4 `autoApproveDueSubmissions()` + الـ job (`*/10 * * * *` ومرة عند الإقلاع، ويحترم `ENABLE_SUBMISSION_AUTO_APPROVE`): `advertiserReview.status = AUTO_APPROVED` و`notifyCreatorApproved({ auto: true })`.
- [ ] B5.5 نفس منع `CAMPAIGN_SUSPENDED` كما في قرارات الطلبات (Sprint 4).

**معايير القبول:** قرار المعلن مرتين ⇒ الثاني `SUBMISSION_ALREADY_REVIEWED`؛ معلن آخر ⇒ `403`؛ الـ job لا يعتمد إلا ما تجاوز `reviewDeadlineAt`، وتشغيله مرتين لا يكرر الإشعارات.

## B6. مواءمة عميل الـ AI — S (تنتظر مهندس الـ AI)
- [ ] B6.1 أرسل له الأسئلة الخمسة (في رد سابق) وسجّل أجوبته في القسم 9 من العقد.
- [ ] B6.2 عدّل `aiSubmissionReview.client.js` (المسار، والمصادقة، وشكل الطلب والرد) واختبر بـ `normalizeAiResponse`.
- [ ] B6.3 إن كان الرد غير فوري (async + callback أو polling) ⇒ نعيد تصميم B3 (أبلغني قبل البدء).

---

# مهام مشتركة (بعد نهاية المسارين)

| # | المهمة | الحجم |
|---|---|---|
| J1 | اختبار تكاملي لثلاثة مسارات كاملة: (1) مقبول، (2) رفض AI ثم إعادة تسليم، (3) مراجعة يدوية. باستعمال `AI_MOCK_RESULT` | M |
| J2 | تحديث `.postman` بالمسارات الاثنين والعشرين | S |
| J3 | تحديث `API_CONTRACT_Sprint5.md` بأي اختلاف فعلي (انظر الجدول أدناه) | S |
| J4 | **النشر على Render:** المتغيرات الجديدة، و`AI_MOCK=true` حتى يجهز الـ AI، وتشغيل `scripts/checkIndexes.js` على قاعدة الإنتاج، وقرار الـ pinger (حدود الخطة المجانية) | S |
| J5 | تسليم الفرونت: العقد + أمثلة استجابة لكل `displayStatus` (من اختبارات J1) + تنبيه كسر `downloadUrl` | S |

---

# ترتيب التنفيذ المقترح

```
اليوم 1      أ: A0.1 (stub) + A5.0 (إصلاح الثغرة)      ب: B1 (على stub) + B2
الأيام 2-3   أ: A0 كاملة + A1 + A2                        ب: B1 تنتهي + B3
الأيام 4-5   أ: A3 + A4                                    ب: B3 تنتهي + B4
الأيام 6-8   أ: A5 + A6                                    ب: B5 (+ B6 عند وصول رد الـ AI)
اليوم 9+     J1 → J5
```
(الأيام أدلة نسبية لتوازن الحمل، وليست جدولاً ملزماً.)

# مؤجَّل عمداً (لا يدخل Sprint 5)
ملف PDF للحملة، وتنزيل ZIP واحد، وإحصاءات إنستغرام (حتى نحصل على توكن Meta)، وقفل ملفات Cloudinary بالكامل (`authenticated`)، وإشعار "أُضيفت مواد جديدة" (لا يوجد endpoint يضيف مواد بعد إنشاء الحملة)، ورسائل الدعم/المجتمع في درج الرسائل، والمكافآت.

# تعديلات على العقد (تُملأ أثناء العمل)
| التاريخ | البند | الاختلاف | من |
|---|---|---|---|
| | | | |