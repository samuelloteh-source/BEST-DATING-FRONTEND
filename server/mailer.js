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

  console.log('mailer config check', {
    hasApiKey: Boolean(process.env.SENDGRID_API_KEY),
    from: process.env.EMAIL_FROM || process.env.FROM_EMAIL,
    to,
    runtime: process.env.VERCEL ? 'vercel' : 'local'
  });

  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY is not configured. Skipping email send.');
    return { success: false, error: 'SENDGRID_API_KEY missing' };
  }

  const htmlContent = html || text || '';
  const textContent = text || (html ? html.replace(/<[^>]*>/g, '').trim() : '');

  if (!htmlContent) {
    console.error('Email content is empty for', to);
    return { success: false, error: 'Email content is empty' };
  }

  const msg = {
    to,
    from: process.env.EMAIL_FROM || process.env.FROM_EMAIL,
    subject: subject || 'Welcome',
    text: textContent,
    html: htmlContent,
  };

  try {
    const result = await sgMail.send(msg);
    console.log(`Email sent to ${to}`, { result: result || null });
    return { success: true, result };
  } catch (error) {
    console.error('SendGrid error:', error.response?.body || error.message);
    return {
      success: false,
      error: error.response?.body || error.message || 'Unknown SendGrid error',
      response: error.response?.body || null,
    };
  }
}

module.exports = { sendMail };
