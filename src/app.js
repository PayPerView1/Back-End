const express = require('express');
const cors = require('cors');
const passport = require('passport');


require('./config/passport');

const app = express();

// Middlewares الأساسية (يتم استخدامها قبل أي مسارات أو إعدادات أخرى)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// تهيئة Passport
app.use(passport.initialize());

// مسار تجريبي (Health Check)
app.get('/', (req, res) => {
  res.send('Pay Per View API is Running...');
});


// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/v1/auth', authRoutes);
const profileRoutes = require('./routes/profileRoutes');
app.use('/api/v1/profile', profileRoutes);

const profileRoutes = require('./routes/profileRoutes');
app.use('/api/v1/profile', profileRoutes);

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const campaignCreationRoutes  = require('./routes/campaign/campaignCreation.routes');
const campaignDraftRoutes     = require('./routes/campaign/campaignDraft.routes');
const campaignManagementRoutes= require('./routes/campaign/campaignManagement.routes');
const campaignCategoryRoutes  = require('./routes/campaign/campaignCategory.routes');


app.use('/api/campaigns', campaignCreationRoutes);
app.use('/api/campaigns', campaignDraftRoutes);
app.use('/api/campaigns', campaignManagementRoutes);
app.use('/api/categories', campaignCategoryRoutes);
module.exports = app;