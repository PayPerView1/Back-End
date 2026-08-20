const sgMail = require('@sendgrid/mail');

// ضبط الـ API Key الخاص بـ SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (options) => {
  try {
    const msg = {
      to: options.email,
      // ⚠️ يجب أن يكون إيميل المرسل دقيقاً ومطابقاً للإيميل الذي تم توثيقه في Single Sender Verification
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER,
        name: 'PayPerView Support',
      },
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

    const response = await sgMail.send(msg);
    console.log(`[SENDGRID SUCCESS] Email sent to: ${options.email} | Status: ${response[0].statusCode}`);
    return response;
  } catch (error) {
    console.error('[SENDGRID ERROR]:', error.response?.body || error.message);
    throw error; // إلقاء الخطأ ليتعامل معه الـ Controller
  }
};

module.exports = sendEmail;
// const nodemailer = require('nodemailer');

// const sendEmail = async (options) => {
//   const transporter = nodemailer.createTransport({
//     host: 'smtp.gmail.com',
//     port: 587,
//     pool: true, // 👈 إعادة استخدام الاتصالات المفتوحة لسرعة فائقة
//     maxConnections: 5,
//     maxMessages: 100,
//     secure: false, // استخدام STARTTLS
//     requireTLS: true,
//     family: 4, // إجبار الاتصال عبر IPv4
//     auth: {
//       user: process.env.SMTP_USER,
//       pass: process.env.SMTP_PASS,
//     },
//     tls: {
//       rejectUnauthorized: false,
//     },
//   });

//   const mailOptions = {
//     from: `PayPerView Support <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
//     to: options.email,
//     subject: options.subject,
//     html: `
//       <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
//         <h2>${options.subject}</h2>
//         <p>${options.message}</p>
//         <hr />
//         <small>PayPerView System Email</small>
//       </div>
//     `,
//   };

//   const info = await transporter.sendMail(mailOptions);
//   console.log(`[NODEMAILER SUCCESS] Message sent to: ${options.email} | ID: ${info.messageId}`);
//   return info;
// };

// module.exports = sendEmail;