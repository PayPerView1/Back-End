// src/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const passport = require('passport');

require('./config/passport');

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const campaignDraftRoutes = require('./routes/campaign/campaignDraft.routes');
const campaignCreationRoutes = require('./routes/campaign/campaignCreation.routes');
const campaignManagementRoutes = require('./routes/campaign/campaignManagement.routes');
const campaignCategoryRoutes = require('./routes/campaign/campaignCategory.routes');
const chatRoutes = require('./routes/ai/chat.routes');

// ⚠️ Sprint 3 — Wallet routes
const walletFundingRoutes = require('./routes/wallet/walletFunding.routes');
const walletAdminRoutes = require('./routes/wallet/walletAdmin.routes');
const transactionHistoryRoutes = require('./routes/wallet/transactionHistory.routes');
const walletRefundRoutes = require('./routes/wallet/walletRefund.routes');

const app = express();
app.use(passport.initialize());

// Middlewares أساسية
app.use(cors());

// ⚠️ لازم يجي قبل express.json() — عشان PayPal webhook يحتاج raw body للتحقق من الـ signature
app.use(
  '/api/v1/wallet/paypal/webhook',
  express.raw({ type: 'application/json' })
);
app.use(express.json());

// عشان الصور المرفوعة تصير قابلة للوصول عن طريق رابط مباشر
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// مسار تجريبي (Health Check)
app.get('/', (req, res) => {
  res.send('Halal Clipping API is Running...');
});

// ============================================
// ربط المسارات
// ============================================

// Auth & Profile
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);

// Campaigns
app.use('/api/v1/campaigns/drafts', campaignDraftRoutes);
app.use('/api/v1/campaigns', campaignCreationRoutes);
app.use('/api/v1/campaigns', campaignManagementRoutes);

// Categories
app.use('/api/v1/categories', campaignCategoryRoutes);

// AI Chat
app.use('/api/v1/chat', chatRoutes);

// ============================================
// Sprint 3 — Wallet & Transactions
// ============================================
// ⚠️ ترتيب مهم:
//   1. /wallet/transactions  → قبل /wallet (عشان ما تتعارض)
//   2. /wallet               → مسارات المعلن (fund, refunds, bank-details, upload, webhook)
//   3. /admin/wallet         → مسارات الأدمن
app.use('/api/v1/wallet/transactions', transactionHistoryRoutes);
app.use('/api/v1/wallet', walletRefundRoutes);
app.use('/api/v1/wallet', walletFundingRoutes);
app.use('/api/v1/admin/wallet', walletAdminRoutes);

module.exports = app;