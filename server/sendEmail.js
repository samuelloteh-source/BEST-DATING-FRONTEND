const sgMail = require('@sendgrid/mail')

let apiKeySet = false

async function sendEmail(to, subject, text) {
  if (!apiKeySet && process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    apiKeySet = true
  }
  
  await sgMail.send({
    to,
    from: process.env.EMAIL_FROM,
    subject,
    text,
  })
  console.log('✅ Email sent to:', to)
}

module.exports = sendEmail
