const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    pool: true, // 👈 إعادة استخدام الاتصالات المفتوحة لسرعة فائقة
    maxConnections: 5,
    maxMessages: 100,
    secure: false, // استخدام STARTTLS
    requireTLS: true,
    family: 4, // إجبار الاتصال عبر IPv4
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
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