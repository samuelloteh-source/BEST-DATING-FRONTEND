import { useState } from 'react'
import axios from './api'

export default function ForgotPassword({ onBackToLogin, onSuccess }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Please enter a valid email address.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const res = await axios.post('/forgot-password', { email })
      if (res.data?.success) {
        setMessage('Check your email for a password reset link. It expires in 1 hour.')
        setEmail('')
        if (onSuccess) onSuccess()
      } else {
        setMessage(res.data?.message || 'Unable to send reset email. Please try again.')
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message
      setMessage('Error: ' + msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-shell">
      <div className="page-card">
        <h1 className="page-title">Reset Your Password</h1>
        <p className="page-subtitle">Enter your email address and we'll send you a link to reset your password.</p>
        <form className="form-card" onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
            />
          </div>
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>
        {message && <p className={`form-message ${message.includes('Check your email') ? 'form-message--success' : ''}`}>{message}</p>}
        <p className="page-note">
          <button type="button" className="button-link" onClick={onBackToLogin}>
            Back to login
          </button>
        </p>
      </div>
    </div>
  )
}
