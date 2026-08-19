const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
//const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');


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
//app.use('/api/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);

module.exports = app;