// src/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const passport = require('passport');

require('./config/passport');

const authRoutes = require('./routes/authRoutes');
const apiDocsRoutes = require('./routes/docs.routes');
const profileRoutes = require('./routes/profileRoutes');
const campaignDraftRoutes = require('./routes/campaign/campaignDraft.routes');
const campaignCreationRoutes = require('./routes/campaign/campaignCreation.routes');
const campaignManagementRoutes= require('./routes/campaign/campaignManagement.routes');
const campaignCategoryRoutes  = require('./routes/campaign/campaignCategory.routes');
const chatRoutes = require('./routes/ai/chat.routes');
const aiIntelligenceRoutes = require('./routes/ai/intelligence.routes');
// Wallet imports
const walletFundingRoutes      = require('./routes/wallet/walletFunding.routes');
const transactionHistoryRoutes = require('./routes/wallet/transactionHistory.routes');
const walletRefundRoutes       = require('./routes/wallet/walletRefund.routes');
const campaignBudgetRoutes     = require('./routes/wallet/campaignBudget.routes');
const walletAdminRoutes        = require('./routes/admin/walletAdmin.routes');
const withdrawalAdminRoutes    = require('./routes/admin/withdrawalAdmin.routes');
const creatorEarningsRoutes    = require('./routes/wallet/creatorEarnings.routes');
// Sprint 4 imports
const campaignDiscoveryRoutes  = require('./routes/campaign/campaignDiscovery.routes');
const applicationRoutes        = require('./routes/application/application.routes');
const reportRoutes             = require('./routes/moderation/report.routes');
const favoriteRoutes           = require('./routes/creator/favorite.routes');
const creatorPreferencesRoutes = require('./routes/creator/creatorPreferences.routes');
const notificationRoutes       = require('./routes/notification/notification.routes');
// Sprint 5 imports
const materialRoutes        = require('./routes/material/material.routes');
const submissionRoutes      = require('./routes/submission/submission.routes');
const submissionAdminRoutes = require('./routes/admin/submissionAdmin.routes');
const submissionViewsRoutes = require('./routes/submission/submissionViews.routes');
const app = express();
app.use(passport.initialize());

// Middlewares أساسية
const allowedFrontendOrigins = new Set(
  (process.env.FRONTEND_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)
);
app.use(cors({
  origin(origin, callback) {
    // Requests without Origin are server-to-server or local health checks.
    if (!origin || allowedFrontendOrigins.has(origin.replace(/\/$/, ''))) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
  credentials: false,
  maxAge: 86400,
}));
app.set('trust proxy', 1);
// ⚠️ لازم يجي قبل express.json() — عشان PayPal webhook يحتاج raw body للتحقق من الـ signature
app.use(
  '/api/v1/wallet/paypal/webhook',
  express.raw({ type: 'application/json' })
);

app.use(                                           // ← جديد
  '/api/v1/wallet/moyasar/webhook',
  express.raw({ type: 'application/json' })
);
app.use(express.json()); // لقراءة البيانات القادمة بصيغة JSON

// عشان الصور المرفوعة تصير قابلة للوصول عن طريق رابط مباشر
// مثال: http://localhost:5000/uploads/campaign-covers/xxx.jpg
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// مسار تجريبي (Health Check)
app.get('/', (req, res) => {
  res.send('Halal Clipping API is Running...');
});

// API reference endpoints are served from the checked-in OpenAPI source of truth.
app.use(apiDocsRoutes);

// ربط المسارات
app.use('/api/v1', aiIntelligenceRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);
// مسارات الفئات العامة الثابتة تسبق مسارات الحملات العامة المحمية ذات المعرّف المتغير.
app.use('/api/v1/campaigns/categories', campaignCategoryRoutes);
app.use('/api/v1/categories', campaignCategoryRoutes);
// Wallet routes — كل router يُركَّب مرة واحدة فقط
// (transactions أولاً لأنها أكثر تحديداً من /api/v1/wallet)
app.use('/api/v1/wallet/transactions', transactionHistoryRoutes);
app.use('/api/v1/wallet', walletRefundRoutes);   // /refund, /refund/:id, /refunds
app.use('/api/v1/wallet', walletFundingRoutes); // /, /fund, /bank-details, webhooks, ...

// Admin wallet routes: PUT /bank-transfer/:id و PUT /refund/:id
// (بادئة /admin مجرد تنظيم للمسارات؛ الحماية الفعلية adminOnly داخل الـ router)
app.use('/api/v1/admin/wallet', walletAdminRoutes);
app.use('/api/v1', withdrawalAdminRoutes);
app.use('/api/v1', creatorEarningsRoutes);
// ⚠️ مسارات الأدمن للتسليم معرّفة داخل الـ router بمسارها الكامل (/admin/submissions/...)
//    لذلك يُركَّب على /api/v1 وليس /api/v1/admin وإلا صارت البادئة مكرّرة.
app.use('/api/v1', submissionAdminRoutes);
// ═══════════════════════════════════════════════════════════════
// Sprint 4 — Discovery, Applications, Reports, Favorites, Notifications
// ⚠️ لازم تجي قبل campaignCreationRoutes و campaignManagementRoutes (وأي router مركَّب
//    على /api/v1/campaigns وفيه router.use(protect, requireBrandRole))، فأي طلب من مبدع
//    (أو زائر) على /campaigns/... يمر عليها أولاً ويأخذ 401/403.
//
// قاعدتان:
//  1) router يمتد على أكثر من بادئة (discovery / applications / reports):
//     مركَّب على /api/v1 ومساراته كاملة، ممنوع فيه router.use(protect, ...)،
//     والـ middleware على كل route على حدة.
//  2) router ببادئة واحدة (favorites / preferences / notifications):
//     مركَّب على بادئته ومساراته نسبية، ويجوز فيه router.use(protect, ...).
// ═══════════════════════════════════════════════════════════════
app.use('/api/v1', campaignDiscoveryRoutes);   // /campaigns/discover, /campaigns/recommendations, /campaigns/:id/details
app.use('/api/v1', applicationRoutes);         // /campaigns/:id/apply, /campaigns/:id/applications, /applications/...
app.use('/api/v1', reportRoutes);              // /campaigns/:id/report, /reports/...
app.use('/api/v1/favorites', favoriteRoutes);
app.use('/api/v1/creator/preferences',creatorPreferencesRoutes);
app.use('/api/v1/notifications', notificationRoutes);
// ═══════════════════════════════════════════════════════════════
// Sprint 5 — تنزيل المواد وتسليم المحتوى
// ⚠️ لازم قبل app.use('/api/v1/campaigns/:campaignId', campaignBudgetRoutes)
// materialRoutes و submissionRoutes: مركَّبة على /api/v1 ومساراتها كاملة (المبدع/المعلن/token)
// ═══════════════════════════════════════════════════════════════
app.use('/api/v1', materialRoutes);
app.use('/api/v1', submissionRoutes);
app.use('/api/v1', submissionViewsRoutes);

// Campaign budget routes
// مركَّب على /api/v1/campaigns ومساراته /:campaignId/budget ... (الـ middleware على كل route)
// ولا يوجد فيه router.use عام، فلا يعترض طلبات غيره ولا يكرر protect.
app.use('/api/v1/campaigns/:campaignId', campaignBudgetRoutes);
// ⚠️ ملاحظة مهمة: /drafts لازم تترط قبل /campaigns العامة (نفس مبدأ "الروابط
// الثابتة أولاً" المذكور بالخطة) — عشان أي توسعة لاحقة (مثلاً /:campaignId من
// campaignManagement.routes تبع الشخص الثاني) ما تتعارض أو تسبق مسارات /drafts
app.use('/api/v1/campaigns/drafts', campaignDraftRoutes);
app.use('/api/v1/campaigns', campaignCreationRoutes);
app.use('/api/v1/campaigns', campaignManagementRoutes);
app.use('/api/v1/chat', chatRoutes);
module.exports = app;
