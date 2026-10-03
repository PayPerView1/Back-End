const express = require('express');
const cors = require('cors');
const path = require('path');
const passport = require('passport');

require('./config/passport');

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const campaignDraftRoutes = require('./routes/campaign/campaignDraft.routes');
const campaignCreationRoutes = require('./routes/campaign/campaignCreation.routes');
const campaignManagementRoutes= require('./routes/campaign/campaignManagement.routes');
const campaignCategoryRoutes  = require('./routes/campaign/campaignCategory.routes');
const chatRoutes = require('./routes/ai/chat.routes');
// Wallet imports
const walletFundingRoutes      = require('./routes/wallet/walletFunding.routes');
const transactionHistoryRoutes = require('./routes/wallet/transactionHistory.routes');
const walletRefundRoutes       = require('./routes/wallet/walletRefund.routes');
const campaignBudgetRoutes     = require('./routes/wallet/campaignBudget.routes');
const app = express();
app.use(passport.initialize());

// Middlewares أساسية
app.use(cors());
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
// مثال: http://localhost:5000/uploads/profile-pictures/xxx.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// مسار تجريبي (Health Check)
app.get('/', (req, res) => {
  res.send('Halal Clipping API is Running...');
});

// ربط المسارات
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);
// Wallet routes
app.use('/api/v1/wallet/transactions', transactionHistoryRoutes);
app.use('/api/v1/wallet/refund',       walletRefundRoutes);
app.use('/api/v1/wallet/refunds',      walletRefundRoutes);
app.use('/api/v1/wallet',              walletFundingRoutes);

// Admin wallet routes
app.use('/api/v1/admin/wallet/bank-transfer', walletFundingRoutes);
app.use('/api/v1/admin/wallet/refund',        walletRefundRoutes);

// Campaign budget routes
// ⚠️ لازم تجي قبل /api/v1/campaigns العامة
// عشان /:campaignId ما يلتقطها قبل budget routes
app.use('/api/v1/campaigns/:campaignId', campaignBudgetRoutes);
// ⚠️ ملاحظة مهمة: /drafts لازم تترط قبل /campaigns العامة (نفس مبدأ "الروابط
// الثابتة أولاً" المذكور بالخطة) — عشان أي توسعة لاحقة (مثلاً /:campaignId من
// campaignManagement.routes تبع الشخص الثاني) ما تتعارض أو تسبق مسارات /drafts
app.use('/api/v1/campaigns/drafts', campaignDraftRoutes);
app.use('/api/v1/campaigns', campaignCreationRoutes);
app.use('/api/v1/campaigns', campaignManagementRoutes);
app.use('/api/v1/categories', campaignCategoryRoutes);
app.use('/api/v1/chat', chatRoutes);
module.exports = app;