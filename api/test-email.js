import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export default async function handler(req, res) {
  try {
    const msg = {
      to: 'sparksinglesdating@gmail.com', // send to yourself first
      from: 'SparkSingles <sparksinglesdating@gmail.com>', // must match verified sender
      subject: 'Test from SparkSingles 🎉',
      text: 'If you got this, SendGrid + Vercel are connected!',
      html: '<strong>If you got this, SendGrid + Vercel are connected!</strong><br>Your dating app can send verification emails now.'
    }
    
    await sgMail.send(msg)
    res.status(200).json({ success: 'Email sent! Check inbox + spam folder' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: error.message })
  }
}
