import { useState, useEffect } from 'react'
import axios from './api'

export default function ResetPassword({ onSuccess, onBackToLogin }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenValid, setTokenValid] = useState(true)

  // Get token and email from URL
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  const email = params.get('email')

  useEffect(() => {
    if (!token || !email) {
      setMessage('Invalid reset link. Please request a new password reset.')
      setTokenValid(false)
    }
  }, [token, email])

  const passwordStrong = password.length >= 10 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!password || !confirmPassword) {
      setMessage('Please enter both passwords.')
      return
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.')
      return
    }

    if (!passwordStrong) {
      setMessage('Password must be at least 10 characters with uppercase, lowercase, number, and symbol.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const res = await axios.post('/reset-password', {
        token,
        email: decodeURIComponent(email),
        password
      })

      if (res.data?.success) {
        setMessage('Password reset successfully! You can now login with your new password.')
        setPassword('')
        setConfirmPassword('')
        if (onSuccess) {
          setTimeout(() => onSuccess(), 2000)
        }
      } else {
        setMessage(res.data?.message || 'Error resetting password.')
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message
      setMessage('Error: ' + msg)
    } finally {
      setLoading(false)
    }
  }

  if (!tokenValid) {
    return (
      <div className="page-shell">
        <div className="page-card">
          <h1 className="page-title">Password Reset</h1>
          <p className="form-message">{message}</p>
          <p className="page-note">
            <button type="button" className="button-link" onClick={onBackToLogin}>
              Back to login
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="page-card">
        <h1 className="page-title">Create New Password</h1>
        <p className="page-subtitle">Enter your new password below.</p>
        <form className="form-card" onSubmit={handleSubmit}>
          <div className="form-field">
            <label>New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your new password"
              required
              disabled={loading}
            />
            <div className="password-criteria" style={{ marginTop: 8, fontSize: '0.9rem', color: '#ccc' }}>
              <div style={{ color: password.length >= 10 ? '#7ed957' : '#ff6b6b' }}>• At least 10 characters</div>
              <div style={{ color: /[A-Z]/.test(password) ? '#7ed957' : '#ff6b6b' }}>• One uppercase letter</div>
              <div style={{ color: /[a-z]/.test(password) ? '#7ed957' : '#ff6b6b' }}>• One lowercase letter</div>
              <div style={{ color: /[0-9]/.test(password) ? '#7ed957' : '#ff6b6b' }}>• One number</div>
              <div style={{ color: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? '#7ed957' : '#ff6b6b' }}>• One symbol</div>
            </div>
          </div>
          <div className="form-field">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              required
              disabled={loading}
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="form-message" style={{ color: '#ff6b6b', marginTop: 4 }}>Passwords do not match</p>
            )}
          </div>
          <button type="submit" className="primary-button" disabled={loading || !passwordStrong}>
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>
        {message && (
          <p className={`form-message ${message.includes('successfully') ? 'form-message--success' : ''}`}>
            {message}
          </p>
        )}
        <p className="page-note">
          <button type="button" className="button-link" onClick={onBackToLogin}>
            Back to login
          </button>
        </p>
      </div>
    </div>
  )
}
