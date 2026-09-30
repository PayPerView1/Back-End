// src/services/emailService.js

const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ----------------------
// الدالة الأساسية — موجودة مسبقاً
// ----------------------
const sendEmail = async (options) => {
  try {
    const msg = {
      to: options.email,
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
    throw error;
  }
};

// ----------------------
// Sprint 3 — Funding Emails
// ----------------------

const sendFundingSuccessEmail = async (advertiser, { grossAmount, commission, netAmount, newBalance, paymentMethod }) => {
  await sendEmail({
    email: advertiser.email,
    subject: 'Wallet Top-Up Successful',
    message: `
      <p>Hi <strong>${advertiser.fullName}</strong>,</p>
      <p>Your wallet has been successfully topped up.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Payment Method</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${paymentMethod}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Gross Amount</td>
          <td style="padding: 8px; border: 1px solid #ddd;">$${grossAmount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Platform Commission</td>
          <td style="padding: 8px; border: 1px solid #ddd;">$${commission.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Net Amount Credited</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>$${netAmount.toFixed(2)}</strong></td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">New Wallet Balance</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>$${newBalance.toFixed(2)}</strong></td>
        </tr>
      </table>
    `,
  });
};

const sendFundingFailedEmail = async (advertiser, { amount, reason }) => {
  await sendEmail({
    email: advertiser.email,
    subject: 'Wallet Top-Up Failed',
    message: `
      <p>Hi <strong>${advertiser.fullName}</strong>,</p>
      <p>Your wallet top-up of <strong>$${amount.toFixed(2)}</strong> could not be completed.</p>
      <p><strong>Reason:</strong> ${reason || 'Payment was declined by the gateway.'}</p>
      <p>Please try again or use a different payment method.</p>
    `,
  });
};

const sendBankTransferReceivedEmail = async (advertiser, { amount, transactionId }) => {
  await sendEmail({
    email: advertiser.email,
    subject: 'Bank Transfer Receipt Received',
    message: `
      <p>Hi <strong>${advertiser.fullName}</strong>,</p>
      <p>We have received your bank transfer receipt for <strong>$${amount.toFixed(2)}</strong>.</p>
      <p><strong>Transaction ID:</strong> ${transactionId}</p>
      <p>Your transfer will be reviewed within <strong>24–48 hours</strong>. We will notify you once it is confirmed.</p>
    `,
  });
};

const sendBankTransferApprovedEmail = async (advertiser, { netAmount, newBalance }) => {
  await sendEmail({
    email: advertiser.email,
    subject: 'Bank Transfer Approved',
    message: `
      <p>Hi <strong>${advertiser.fullName}</strong>,</p>
      <p>Your bank transfer has been approved and your wallet has been credited.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Amount Credited</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>$${netAmount.toFixed(2)}</strong></td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">New Wallet Balance</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>$${newBalance.toFixed(2)}</strong></td>
        </tr>
      </table>
    `,
  });
};

const sendBankTransferRejectedEmail = async (advertiser, { amount, note }) => {
  await sendEmail({
    email: advertiser.email,
    subject: 'Bank Transfer Rejected',
    message: `
      <p>Hi <strong>${advertiser.fullName}</strong>,</p>
      <p>Unfortunately, your bank transfer of <strong>$${amount.toFixed(2)}</strong> has been rejected.</p>
      <p><strong>Reason:</strong> ${note || 'The receipt could not be verified.'}</p>
      <p>Please resubmit with a clear receipt or contact support.</p>
    `,
  });
};

// ----------------------
// Sprint 3 — Budget Emails
// ----------------------

const sendBudgetExhaustedEmail = async (advertiser, { campaignName, campaignId }) => {
  await sendEmail({
    email: advertiser.email,
    subject: 'Campaign Paused — Budget Exhausted',
    message: `
      <p>Hi <strong>${advertiser.fullName}</strong>,</p>
      <p>Your campaign <strong>${campaignName}</strong> has been automatically paused because its budget has been fully consumed.</p>
      <p>To resume the campaign, please recharge its budget from your dashboard.</p>
      <p><strong>Campaign ID:</strong> ${campaignId}</p>
    `,
  });
};

// ----------------------
// Sprint 3 — Refund Emails
// ----------------------

const sendRefundSubmittedEmail = async (advertiser, { amount, refundRequestId }) => {
  await sendEmail({
    email: advertiser.email,
    subject: 'Refund Request Submitted',
    message: `
      <p>Hi <strong>${advertiser.fullName}</strong>,</p>
      <p>Your refund request for <strong>$${amount.toFixed(2)}</strong> has been received.</p>
      <p><strong>Request ID:</strong> ${refundRequestId}</p>
      <p>It will be reviewed within <strong>24–48 hours</strong>. We will notify you of the outcome.</p>
    `,
  });
};

const sendRefundApprovedEmail = async (advertiser, { amount, netAmount, refundMethod }) => {
  await sendEmail({
    email: advertiser.email,
    subject: 'Refund Request Approved',
    message: `
      <p>Hi <strong>${advertiser.fullName}</strong>,</p>
      <p>Your refund request has been approved.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Requested Amount</td>
          <td style="padding: 8px; border: 1px solid #ddd;">$${amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Net Refund Amount</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>$${netAmount.toFixed(2)}</strong></td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Refund Method</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${refundMethod}</td>
        </tr>
      </table>
      <p>Funds will be returned via gateway processing time.</p>
    `,
  });
};

const sendRefundRejectedEmail = async (advertiser, { amount, note }) => {
  await sendEmail({
    email: advertiser.email,
    subject: 'Refund Request Rejected',
    message: `
      <p>Hi <strong>${advertiser.fullName}</strong>,</p>
      <p>Your refund request for <strong>$${amount.toFixed(2)}</strong> has been rejected.</p>
      <p><strong>Reason:</strong> ${note || 'Request did not meet refund conditions.'}</p>
      <p>The held amount has been returned to your wallet balance.</p>
    `,
  });
};

const sendRefundCancelledEmail = async (advertiser, { amount }) => {
  await sendEmail({
    email: advertiser.email,
    subject: 'Refund Request Cancelled',
    message: `
      <p>Hi <strong>${advertiser.fullName}</strong>,</p>
      <p>Your refund request for <strong>$${amount.toFixed(2)}</strong> has been cancelled.</p>
      <p>The amount has been returned to your wallet balance.</p>
    `,
  });
};

module.exports = {
  sendEmail,
  // Funding
  sendFundingSuccessEmail,
  sendFundingFailedEmail,
  sendBankTransferReceivedEmail,
  sendBankTransferApprovedEmail,
  sendBankTransferRejectedEmail,
  // Budget
  sendBudgetExhaustedEmail,
  // Refund
  sendRefundSubmittedEmail,
  sendRefundApprovedEmail,
  sendRefundRejectedEmail,
  sendRefundCancelledEmail,
};
// const sgMail = require('@sendgrid/mail');

// // ضبط الـ API Key الخاص بـ SendGrid
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// const sendEmail = async (options) => {
//   try {
//     const msg = {
//       to: options.email,
//       // ⚠️ يجب أن يكون إيميل المرسل دقيقاً ومطابقاً للإيميل الذي تم توثيقه في Single Sender Verification
//       from: {
//         email: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER,
//         name: 'PayPerView Support',
//       },
//       subject: options.subject,
//       html: `
//         <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
//           <h2>${options.subject}</h2>
//           <p>${options.message}</p>
//           <hr />
//           <small>PayPerView System Email</small>
//         </div>
//       `,
//     };

//     const response = await sgMail.send(msg);
//     console.log(`[SENDGRID SUCCESS] Email sent to: ${options.email} | Status: ${response[0].statusCode}`);
//     return response;
//   } catch (error) {
//     console.error('[SENDGRID ERROR]:', error.response?.body || error.message);
//     throw error; // إلقاء الخطأ ليتعامل معه الـ Controller
//   }
// };

// module.exports = sendEmail;