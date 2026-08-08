const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares أساسية
app.use(cors());
app.use(express.json()); // لقراءة البيانات القادمة بصيغة JSON

// مسار تجريبي (Health Check)
app.get('/', (req, res) => {
  res.send('Halal Clipping API is Running...');
});

module.exports = app;