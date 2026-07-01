const path = require('path');
const dotenv = require('dotenv');
const sgMail = require('@sendgrid/mail');

dotenv.config({ path: path.join(__dirname, '.env') });

let apiKeyConfigured = false;

function ensureMailerConfigured() {
  if (!apiKeyConfigured && process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    apiKeyConfigured = true;
  }
}

async function sendMail({ to, subject, text, html }) {
  ensureMailerConfigured();

  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY is not configured. Skipping email send.');
    return { success: false, error: 'SENDGRID_API_KEY missing' };
  }

  const msg = {
    to,
    from: process.env.EMAIL_FROM || process.env.FROM_EMAIL,
    subject: subject || 'Welcome',
    text: text || '',
    html: html || text || '',
  };

  try {
    await sgMail.send(msg);
    console.log(`Email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('SendGrid error:', error.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendMail };
