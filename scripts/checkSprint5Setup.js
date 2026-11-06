// scripts/checkSprint5Setup.js
// فحص تكاملي سريع لإعداد Sprint 5 على مشروعك. يلتقط أخطاء الدمج الشائعة:
// ثابت ناقص، قالب إشعار ناقص، بريد غير مُصدَّر، حقل حملة غير مضاف، فهرس غير مبني...
//
// التشغيل:   node scripts/checkSprint5Setup.js          (يتصل بقاعدة البيانات إن وُجد MONGO_URI)
//            node scripts/checkSprint5Setup.js --no-db  (بدون قاعدة بيانات)
//
// للقراءة فقط: لا يكتب في قاعدة البيانات، ولا يطبع قيم المتغيرات السرية.
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skipDb = process.argv.includes('--no-db');
const results = [];

const record = (status, name, detail = '') => {
  results.push(status);
  const icon = { ok: '✅', warn: '⚠️ ', fail: '❌' }[status];
  console.log(`${icon} ${name}${detail ? `\n     ${detail}` : ''}`);
};

// fn يرجع undefined (نجاح) أو { warn } أو يرمي (فشل)
const check = async (name, fn) => {
  try {
    const outcome = await fn();
    if (outcome && outcome.warn) record('warn', name, outcome.warn);
    else record('ok', name, outcome && outcome.info ? outcome.info : '');
  } catch (error) {
    record('fail', name, error.message.split('\n')[0]);
  }
};

const section = (title) => console.log(`\n── ${title} ──`);
const need = (condition, message) => {
  if (!condition) throw new Error(message);
};
const src = (...parts) => path.join(root, 'src', ...parts);

(async () => {
  // ───────────── البيئة ─────────────
  section('البيئة');

  await check('Node >= 18', () => {
    const major = Number(process.versions.node.split('.')[0]);
    need(major >= 18, `الإصدار الحالي ${process.versions.node}`);
  });

  await check('.env مستثنى من git', () => {
    const file = path.join(root, '.gitignore');
    need(fs.existsSync(file), 'لا يوجد ملف .gitignore');
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim());
    need(lines.some((l) => l === '.env' || l === '.env*' || l === '*.env'), '.env غير مذكور في .gitignore');
  });

  await check('jest وأدوات الاختبار في devDependencies فقط', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const dev = ['jest', 'supertest', 'mongodb-memory-server'];
    const misplaced = dev.filter((name) => pkg.dependencies && pkg.dependencies[name]);
    if (misplaced.length) return { warn: `موجودة في dependencies: ${misplaced.join(', ')} (تُثبَّت في الإنتاج على Render)` };
  });

  const REQUIRED_ENV = ['JWT_SECRET', 'MONGO_URI', 'DOWNLOAD_LINK_SECRET'];
  const OPTIONAL_ENV = [
    ['YOUTUBE_API_KEY', 'بدونه لا تُقرأ بيانات يوتيوب'],
    ['AI_MOCK', 'ضعه true حتى يجهز الـ AI'],
    ['IP_HASH_SECRET', 'بدونه لا يُخزَّن hash للـ IP'],
    ['MODERATION_TEAM_EMAIL', 'بدونه لا يصل بريد للأدمن'],
    ['FRONTEND_URL', 'مطلوب لروابط تأكيد بلاغ الزائر'],
  ];

  await check('متغيرات بيئة إلزامية', () => {
    const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
    need(missing.length === 0, `ناقصة: ${missing.join(', ')}`);
  });

  await check('متغيرات بيئة اختيارية', () => {
    const missing = OPTIONAL_ENV.filter(([name]) => !process.env[name]).map(([name, why]) => `${name} (${why})`);
    if (missing.length) return { warn: missing.join(' | ') };
  });

  await check('DOWNLOAD_LINK_SECRET مختلف عن JWT_SECRET', () => {
    if (process.env.DOWNLOAD_LINK_SECRET && process.env.DOWNLOAD_LINK_SECRET === process.env.JWT_SECRET) {
      throw new Error('يجب أن يكون سراً مختلفاً');
    }
  });

  // ───────────── الثوابت والأخطاء ─────────────
  section('الثوابت والأخطاء');

  await check('CAMPAIGN_ACTION فيه القيم الأربع الجديدة', () => {
    const { CAMPAIGN_ACTION } = require(src('constants', 'campaign.constants'));
    const wanted = ['MATERIALS_DOWNLOADED', 'SUBMISSION_RECEIVED', 'SUBMISSION_APPROVED', 'SUBMISSION_REJECTED'];
    const missing = wanted.filter((k) => !CAMPAIGN_ACTION[k]);
    need(missing.length === 0, `ناقصة: ${missing.join(', ')}`);
  });

  await check('NOTIFICATION_TYPE فيه الأنواع التسعة الجديدة', () => {
    const { NOTIFICATION_TYPE } = require(src('constants', 'discovery.constants'));
    const wanted = [
      'NEW_SUBMISSION', 'SUBMISSION_AI_APPROVED', 'SUBMISSION_AI_REJECTED', 'SUBMISSION_MANUAL_REVIEW',
      'MANUAL_REVIEW_REQUIRED', 'SUBMISSION_APPROVED', 'SUBMISSION_REJECTED', 'DOWNLOAD_COMPLETED', 'DOWNLOAD_FAILED',
    ];
    const missing = wanted.filter((k) => !NOTIFICATION_TYPE[k]);
    need(missing.length === 0, `ناقصة: ${missing.join(', ')}`);
  });

  await check('لكل نوع إشعار قالب (وإلا يرمي buildNotification)', () => {
    const { NOTIFICATION_TYPE } = require(src('constants', 'discovery.constants'));
    const { TEMPLATES } = require(src('services', 'notification', 'notification.templates'));
    const missing = Object.values(NOTIFICATION_TYPE).filter((type) => typeof TEMPLATES[type] !== 'function');
    need(missing.length === 0, `بلا قالب: ${missing.join(', ')}`);
    // لا مفتاح "undefined" في القوالب (علامة ترتيب خاطئ: القوالب قبل الثوابت)
    need(!('undefined' in TEMPLATES), 'يوجد قالب بمفتاح undefined: أضف NOTIFICATION_TYPE قبل القوالب');
  });

  await check('errors.js: الأكواد الجديدة ودعم details', () => {
    const { AppError, STATUS_BY_CODE } = require(src('utils', 'errors'));
    const wanted = [
      'INVALID_LINK', 'UNSUPPORTED_PLATFORM', 'PLATFORM_MISMATCH', 'POST_NOT_PUBLIC', 'CONTENT_REQUIREMENTS_NOT_MET',
      'LINK_ALREADY_SUBMITTED', 'SUBMISSION_LIMIT_REACHED', 'SUBMISSION_NOT_WITHDRAWABLE', 'SUBMISSION_NOT_EDITABLE',
      'SUBMISSION_ALREADY_REVIEWED', 'DOWNLOAD_LINK_EXPIRED', 'APPLICATION_NOT_ACCEPTED',
    ];
    const missing = wanted.filter((code) => !STATUS_BY_CODE[code]);
    need(missing.length === 0, `أكواد ناقصة: ${missing.join(', ')}`);
    const e = new AppError('x', 'INVALID_LINK', undefined, { hint: 'h' });
    need(e.details && e.details.hint === 'h', 'AppError لا يدعم الوسيط الرابع details');
    need(e.statusCode === 400, 'رمز الحالة غير صحيح');
  });

  await check('sendError يُرجع details في الاستجابة', () => {
    const { AppError, sendError } = require(src('utils', 'errors'));
    let body = null;
    const res = { status: () => ({ json: (b) => { body = b; } }) };
    sendError(res, new AppError('x', 'LINK_ALREADY_SUBMITTED', undefined, { a: 1 }), 'check');
    need(body && body.details && body.details.a === 1, 'sendError لا يضيف details للاستجابة');
  });

  await check('notificationEmails: الدوال الخمس الجديدة', () => {
    const emails = require(src('services', 'notification', 'notificationEmails'));
    const wanted = [
      'sendNewSubmissionEmail', 'sendSubmissionAiRejectedEmail', 'sendSubmissionApprovedEmail',
      'sendSubmissionRejectedEmail', 'sendManualReviewAdminEmail',
    ];
    const missing = wanted.filter((fn) => typeof emails[fn] !== 'function');
    need(missing.length === 0, `غير مُصدَّرة: ${missing.join(', ')}`);
  });

  // ───────────── النماذج ─────────────
  section('النماذج');

  await check('نماذج Sprint 5 تُحمَّل', () => {
    ['submission', 'submissionDraft', 'downloadLog'].forEach((name) => require(src('models', name)));
  });

  await check('Campaign: حقول Sprint 5', () => {
    const Campaign = require(src('models', 'campaign'));
  need(Campaign.schema.path('submissionRequirements.platforms'), 'submissionRequirements غير موجود');
  need(Campaign.schema.path('maxSubmissionsPerCreator'), 'maxSubmissionsPerCreator غير موجود');
  });

  await check('CampaignDraft: حقول Sprint 5', () => {
    const Draft = require(src('models', 'CampaignDraft'));
    need(Draft.schema.path('submissionRequirements.requiredHashtags'), 'submissionRequirements غير موجود');
    need(Draft.schema.path('maxSubmissionsPerCreator'), 'maxSubmissionsPerCreator غير موجود');
  });

  await check('اسم ملف user.js بحروف صغيرة (Linux على Render حساس لحالة الأحرف)', () => {
    const files = fs.readdirSync(src('models'));
    need(files.includes('user.js'), `الموجود: ${files.filter((f) => /^user/i.test(f)).join(', ') || 'لا شيء'}`);
  });

  // ───────────── التطبيق ─────────────
  section('التطبيق');

  await check('app.js يُحمَّل (الـ routers الجديدة موجودة ومركّبة)', () => {
    require(src('app'));
    const code = fs.readFileSync(src('app.js'), 'utf8');
    const wanted = ['material.routes', 'submission.routes', 'submissionAdmin.routes'];
    const missing = wanted.filter((name) => !code.includes(name));
    need(missing.length === 0, `غير مستوردة في app.js: ${missing.join(', ')}`);
    const budgetAt = code.indexOf("campaignBudgetRoutes);");
    const submissionAt = code.indexOf("app.use('/api/v1', submissionRoutes)");
    need(submissionAt !== -1, "لم أجد app.use('/api/v1', submissionRoutes)");
    need(budgetAt === -1 || submissionAt < budgetAt, 'يجب تركيب submissionRoutes قبل campaignBudgetRoutes');
  });

  await check('server.js يستورد jobs سبرنت 5', () => {
    const code = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    need(code.includes('submissionProcessor.job') && code.includes('submissionAutoApprove.job'), 'الـ jobs غير مستوردة');
    need(/await\s+connectDB\(\)/.test(code), 'server.js لا ينتظر connectDB()');
  });

  // ───────────── قاعدة البيانات ─────────────
  section('قاعدة البيانات (قراءة فقط)');

  if (skipDb || !process.env.MONGO_URI) {
    record('warn', 'فحص الفهارس تم تخطيه', skipDb ? 'استُعمل --no-db' : 'MONGO_URI غير مضبوط');
  } else {
    const mongoose = require('mongoose');
    try {
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
      record('ok', 'الاتصال بقاعدة البيانات');

      await check('Submission: فهرس منع التكرار (فريد جزئي)', async () => {
        const Submission = require(src('models', 'submission'));
        await Submission.init();
        const indexes = await Submission.collection.indexes();
        const dedup = indexes.find((i) => i.key && i.key.dedupKey === 1);
        need(dedup, 'فهرس dedupKey غير موجود');
        need(dedup.unique === true, 'الفهرس غير فريد');
        need(dedup.partialFilterExpression && dedup.partialFilterExpression.linkLocked === true, 'الفهرس ليس جزئياً على linkLocked');
      });

      await check('SubmissionDraft: فريد (مبدع، حملة) + TTL', async () => {
        const Draft = require(src('models', 'submissionDraft'));
        await Draft.init();
        const indexes = await Draft.collection.indexes();
        need(indexes.some((i) => i.unique && i.key.creatorId === 1 && i.key.campaignId === 1), 'الفهرس الفريد ناقص');
        need(indexes.some((i) => i.key.expiresAt === 1 && i.expireAfterSeconds === 0), 'فهرس TTL ناقص');
      });

      await check('DownloadLog: الفهارس', async () => {
        const Log = require(src('models', 'downloadLog'));
        await Log.init();
        const indexes = await Log.collection.indexes();
        need(indexes.some((i) => i.key.campaignId === 1), 'فهرس campaignId ناقص');
      });
    } catch (error) {
      record('fail', 'الاتصال بقاعدة البيانات', error.message);
    } finally {
      await mongoose.disconnect().catch(() => {});
    }
  }

  // ───────────── الملخص ─────────────
  const count = (s) => results.filter((r) => r === s).length;
  console.log(`\n── الملخص ──\n✅ ${count('ok')}   ⚠️  ${count('warn')}   ❌ ${count('fail')}`);
  if (count('fail')) {
    console.log('أصلح الفقرات ❌ أولاً (كل رسالة تقول ما الناقص). الجدول في docs/BATCH1_SETUP_Sprint5.md يبيّن مصدر كل تعديل.');
    process.exitCode = 1;
  }
})();