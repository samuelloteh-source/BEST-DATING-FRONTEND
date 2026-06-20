import { useState, useEffect } from 'react'
import axios from 'axios'
import Discovery from './Discovery'
import Matches from './Matches'
import Messaging from './Messaging'
import Profile from './Profile'
import Likes from './Likes'

const interestOptions = [
  'Travel', 'Cooking', 'Music', 'Fitness', 'Movies', 'Reading', 'Art & Culture',
  'swimming', 'hiking', 'gym & fitness', 'sports', 'jollof wars'
]

function App() {
  const [view, setView] = useState('login')
  const [currentPage, setCurrentPage] = useState('discover')
  const [user, setUser] = useState(null)
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'))
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [message, setMessage] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [signup, setSignup] = useState({
    firstName: '', lastName: '', email: '', password: '', dob: '', country: '', stateRegion: '',
    interests: [], bio: '', profileFile: null
  })

  const runtimeHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'localhost'
    : window.location.hostname
  const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${runtimeHost}:3001`

  axios.defaults.withCredentials = false

  useEffect(() => {
    axios.defaults.baseURL = apiBaseUrl
  }, [apiBaseUrl])

  useEffect(() => {
    const path = window.location.pathname
    if (path === '/signup') {
      setView('signup')
    } else if (path === '/login') {
      setView('login')
    }
  }, [])

  useEffect(() => {
    if (authToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`
      fetchNotifications()
    }
    fetchCurrentUser()
  }, [authToken])

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${apiBaseUrl}/notifications`)
      if (res.data?.success) {
        setNotifications(res.data.notifications || [])
      }
    } catch (err) {
      console.error('Failed to load notifications:', err)
      setNotifications([])
    }
  }

  const fetchCurrentUser = async () => {
    try {
      const res = await axios.get(`${apiBaseUrl}/me`)
      setUser(res.data.user || res.data)
      setView('app')
    } catch (err) {
      localStorage.removeItem('authToken')
      setAuthToken(null)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const res = await axios.post(`${apiBaseUrl}/login`, { email: loginEmail, password: loginPassword })
      if (res.data?.success) {
        setMessage('Login successful!')
        setLoginEmail('')
        setLoginPassword('')
        if (res.data?.token) {
          localStorage.setItem('authToken', res.data.token)
          axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`
          setAuthToken(res.data.token)
        }
        if (res.data?.user) {
          setUser(res.data.user)
          setView('app')
        } else {
          await fetchCurrentUser()
        }
        await fetchNotifications()
      } else {
        setMessage(res.data?.message || 'Login failed')
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message
      setMessage('Error: ' + msg)
    }
  }

  const handleLogout = async () => {
    try { await axios.post(`${apiBaseUrl}/logout`) } catch (e) {}
    localStorage.removeItem('authToken')
    setAuthToken(null)
    setUser(null)
    setView('login')
    setCurrentPage('discover')
    setSelectedMatch(null)
    setNotifications([])
    setNotificationsOpen(false)
  }

  const handleToggleNotifications = async () => {
    if (!notificationsOpen) {
      await fetchNotifications()
    }
    setNotificationsOpen(prev => !prev)
  }

  const handleClearNotifications = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const refreshNotifications = async () => {
    await fetchNotifications()
  }

  const handleSignupChange = (field, value) => setSignup(prev => ({ ...prev, [field]: value }))
  const toggleInterest = (interest) => setSignup(prev => ({ ...prev, interests: prev.interests.includes(interest) ? prev.interests.filter(i=>i!==interest) : [...prev.interests, interest] }))
  const handleFileChange = (e) => handleSignupChange('profileFile', e.target.files?.[0] || null)
  const goNext = () => setStep(s=>Math.min(s+1,3))
  const goBack = () => setStep(s=>Math.max(s-1,1))

  const handleSignupSubmit = async (e) => {
    e.preventDefault()
    if (step < 3) { goNext(); return }
    try {
      const formData = new FormData()
      formData.append('name', `${signup.firstName} ${signup.lastName}`)
      formData.append('email', signup.email)
      formData.append('password', signup.password)
      formData.append('dob', signup.dob)
      formData.append('country', signup.country)
      formData.append('state', signup.stateRegion)
      formData.append('interests', signup.interests.join(', '))
      formData.append('bio', signup.bio)
      if (signup.profileFile) formData.append('photo', signup.profileFile)

      const res = await axios.post(`${apiBaseUrl}/signup`, formData)
      if (res.data?.success) {
        setMessage('Signup complete! Please log in.')
        setView('login')
        setStep(1)
        setSignup({ firstName:'', lastName:'', email:'', password:'', dob:'', country:'', stateRegion:'', interests:[], bio:'', profileFile:null })
      } else {
        setMessage('Signup failed: ' + (res.data?.message || 'Please try again.'))
      }
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.message || err.message))
    }
  }

  const loginView = (
    <div className="page-shell">
      <div className="page-card">
        <h1 className="page-title">SPARK A CONNECTION</h1>
        <p className="page-subtitle">Welcome back — login to continue and spark a connection.</p>
        <form className="form-card" onSubmit={handleLogin}>
          <div className="form-field">
            <label>Email</label>
            <input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="form-field">
            <label>Password</label>
            <input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="Enter your password" required />
          </div>
          <button type="submit" className="primary-button">Login</button>
        </form>
        <p className="page-note">Don't have an account? <button type="button" className="button-link" onClick={() => { setView('signup'); setStep(1); setMessage(''); window.history.pushState({}, '', '/signup') }}>Signup</button></p>
        {message && <p className="form-message">{message}</p>}
      </div>
    </div>
  )

  const signupView = (
    <div className="page-shell">
      <div className="page-card">
        <h1 className="page-title">Signup</h1>
        <p className="page-subtitle">Finish your profile in three quick steps.</p>
        <div className="step-indicator">Step {step} of 3</div>
        <form className="form-card" onSubmit={handleSignupSubmit}>
          {step === 1 && (
            <>
              <div className="form-field"><label>First name</label><input type="text" value={signup.firstName} onChange={e=>handleSignupChange('firstName', e.target.value)} placeholder="First name" required/></div>
              <div className="form-field"><label>Last name</label><input type="text" value={signup.lastName} onChange={e=>handleSignupChange('lastName', e.target.value)} placeholder="Last name" required/></div>
              <div className="form-field"><label>Email</label><input type="email" value={signup.email} onChange={e=>handleSignupChange('email', e.target.value)} placeholder="you@example.com" required/></div>
              <div className="form-field"><label>Password</label><input type="password" value={signup.password} onChange={e=>handleSignupChange('password', e.target.value)} placeholder="Create a password" required/></div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="form-field"><label>Date of birth</label><input type="date" value={signup.dob} onChange={e=>handleSignupChange('dob', e.target.value)} required/></div>
              <div className="form-field"><label>Country</label><input type="text" value={signup.country} onChange={e=>handleSignupChange('country', e.target.value)} placeholder="Country" required/></div>
              <div className="form-field"><label>State or region</label><input type="text" value={signup.stateRegion} onChange={e=>handleSignupChange('stateRegion', e.target.value)} placeholder="State or region" required/></div>
              <div className="form-field"><label>Interests</label><div className="interests-list">{interestOptions.map(i=> (<button key={i} type="button" className={signup.interests.includes(i)?'interest-button active':'interest-button'} onClick={()=>toggleInterest(i)}>{i}</button>))}</div></div>
            </>
          )}
          {step === 3 && (
            <>
              <div className="form-field"><label>Bio</label><textarea value={signup.bio} onChange={e=>handleSignupChange('bio', e.target.value)} placeholder="Share something interesting about yourself" rows={5} required/></div>
              <div className="form-field"><label>Upload profile photo</label><input type="file" accept="image/*" onChange={handleFileChange}/>{signup.profileFile && <p className="file-note">Selected file: {signup.profileFile.name}</p>}</div>
            </>
          )}
          <div className="button-row">{step>1 && <button type="button" className="secondary-button" onClick={goBack}>Back</button>}<button type="submit" className="primary-button">{step<3?'Next':'Finish signup'}</button></div>
        </form>
        <p className="page-note">Already have an account? <button type="button" className="button-link" onClick={() => { setView('login'); setMessage(''); window.history.pushState({}, '', '/') }}>Login</button></p>
        {message && <p className="form-message">{message}</p>}
      </div>
    </div>
  )

  if (view === 'app' && user) {
    if (selectedMatch) return <Messaging user={user} match={selectedMatch} onBack={() => setSelectedMatch(null)} />

    const pageContent = currentPage === 'discover'
      ? <Discovery user={user} onLogout={handleLogout} onMatch={refreshNotifications} showHeader={false} />
      : currentPage === 'matches'
        ? <Matches user={user} onSelectMatch={setSelectedMatch} onLogout={handleLogout} />
        : currentPage === 'likes'
          ? <Likes />
          : <Profile user={user} onUpdateUser={setUser} onLogout={handleLogout} />

    return (
      <>
        {currentPage === 'discover' && (
          <div className="app-bar">
            <div>
              <h1>Discover</h1>
              <p className="app-bar-subtitle">Find your next match and message them when it clicks.</p>
            </div>
            <div className="app-bar-actions">
              <button className="notification-btn" onClick={handleToggleNotifications}>
                🔔 {notifications.filter(n => !n.read).length}
              </button>
              <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        )}
        {currentPage === 'discover' && notificationsOpen && (
          <div className="notification-panel">
            <div className="notification-panel-header">
              <span>Notifications</span>
              <button className="clear-notifications" onClick={handleClearNotifications}>Mark read</button>
            </div>
            {notifications.length === 0 ? (
              <div className="no-notifications">No new notifications.</div>
            ) : (
              <div className="notification-list">
                {notifications.map(note => (
                  <div key={note.id} className={`notification-item ${note.read ? 'read' : 'unread'}`}>
                    <strong>{note.text}</strong>
                    <span>{new Date(note.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {pageContent}
        <div className="app-navigation">
          <button className={`nav-btn ${currentPage === 'discover' ? 'active' : ''}`} onClick={() => setCurrentPage('discover')}>Discover</button>
          <button className={`nav-btn ${currentPage === 'matches' ? 'active' : ''}`} onClick={() => setCurrentPage('matches')}>Matches</button>
          <button className={`nav-btn ${currentPage === 'likes' ? 'active' : ''}`} onClick={() => setCurrentPage('likes')}>Likes</button>
          <button className={`nav-btn ${currentPage === 'profile' ? 'active' : ''}`} onClick={() => setCurrentPage('profile')}>Profile</button>
        </div>
      </>
    )
  }

  return view === 'signup' ? signupView : loginView
}

export default App
