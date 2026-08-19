require('dotenv').config();

// فحص متغيرات البيئة الأساسية قبل التشغيل
if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in .env file.');
  process.exit(1);
}

const app = require('./src/app');
const connectDB = require('./src/config/db.js');

// الاتصال بقاعدة البيانات
connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});