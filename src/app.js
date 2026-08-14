const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares أساسية
app.use(cors());
app.use(express.json()); // لقراءة البيانات القادمة بصيغة JSON
app.get('/test-route', (req, res) => {
  res.json({ message: 'Routing is working!' });
});
// مسار تجريبي (Health Check)
app.get('/', (req, res) => {
  res.send('Halal Clipping API is Running...');
});

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/v1/auth', authRoutes);

module.exports = app;