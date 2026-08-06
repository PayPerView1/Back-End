require('dotenv').config();
const app = require('./src/index');
const connectDB = require('./src/config/db.js');

// الاتصال بقاعدة البيانات
connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});