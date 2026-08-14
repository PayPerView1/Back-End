// src/services/emailService.js
const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // استخدام STARTTLS بدلاً من SSL المباشر (الذي يسبب 465 ETIMEDOUT)
    requireTLS: true,
    family: 4, // إجبار الاتصال عبر IPv4 فقط لتجنب مهلة IPv6
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false, // لتجاوز أي مشاكل في شهادات الحماية الخاصة بالشبكة المحلية
    },
  });

  const mailOptions = {
    from: `PayPerView Support <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to: options.email,
    subject: options.subject,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>${options.subject}</h2>
        <p>${options.message}</p>
        <hr />
        <small>PayPerView System Email</small>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`[NODEMAILER SUCCESS] Message sent to: ${options.email} | ID: ${info.messageId}`);
  return info;
};

module.exports = sendEmail;

// // src/services/emailService.js
// // يمكنك في البداية طباعة الرابط في الـ Console لاختبار التسجيل بسهولة
// const sendEmail = async (options) => {
//   console.log('----------------------------------------------------');
//   console.log(`[EMAIL SIMULATOR] To: ${options.email}`);
//   console.log(`[EMAIL SIMULATOR] Subject: ${options.subject}`);
//   console.log(`[EMAIL SIMULATOR] Message: ${options.message}`);
//   console.log('----------------------------------------------------');
  
//   // لاحقاً يمكنك استبدال هذا بـ Nodemailer أو SendGrid بسهولة
//   return true;
// };

// module.exports = sendEmail;