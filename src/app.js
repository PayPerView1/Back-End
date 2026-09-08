const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const campaignDraftRoutes = require('./routes/campaign/campaignDraft.routes');
const campaignCreationRoutes = require('./routes/campaign/campaignCreation.routes');

const app = express();

// Middlewares أساسية
app.use(cors());
app.use(express.json()); // لقراءة البيانات القادمة بصيغة JSON

// عشان الصور المرفوعة تصير قابلة للوصول عن طريق رابط مباشر
// مثال: http://localhost:5000/uploads/profile-pictures/xxx.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// مسار تجريبي (Health Check)
app.get('/', (req, res) => {
  res.send('Halal Clipping API is Running...');
});

// ربط المسارات
app.use('/api/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);

// ⚠️ ملاحظة مهمة: /drafts لازم تترط قبل /campaigns العامة (نفس مبدأ "الروابط
// الثابتة أولاً" المذكور بالخطة) — عشان أي توسعة لاحقة (مثلاً /:campaignId من
// campaignManagement.routes تبع الشخص الثاني) ما تتعارض أو تسبق مسارات /drafts
app.use('/api/v1/campaigns/drafts', campaignDraftRoutes);
app.use('/api/v1/campaigns', campaignCreationRoutes);


const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// const campaignCreationRoutes  = require('./routes/campaign/campaignCreation.routes');
// const campaignDraftRoutes     = require('./routes/campaign/campaignDraft.routes');
const campaignManagementRoutes= require('./routes/campaign/campaignManagement.routes');
const campaignCategoryRoutes  = require('./routes/campaign/campaignCategory.routes');


// app.use('/api/campaigns', campaignCreationRoutes);
// app.use('/api/campaigns', campaignDraftRoutes);
app.use('/api/campaigns', campaignManagementRoutes);
app.use('/api/categories', campaignCategoryRoutes);
module.exports = app;