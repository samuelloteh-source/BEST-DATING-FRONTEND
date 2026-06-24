import { useState, useEffect } from 'react'
import axios, { resolveImageUrl } from './api'
import './App.css'
import Discovery from './Discovery'
import Matches from './Matches'
import MessagesList from './MessagesList'
import Messaging from './Messaging'
import Profile from './Profile'
import FaceCapture from './FaceCapture'
import Likes from './Likes'

const interestOptions = [
  'Travel', 'Cooking', 'Music', 'Fitness', 'Movies', 'Reading', 'Art & Culture',
  'swimming', 'hiking', 'gym & fitness', 'sports', 'jollof wars'
]

function App() {
  const [view, setView] = useState(() => {
    const path = window.location.pathname.replace(/\/$/, '')
    if (path === '/signup') return 'signup'
    if (path === '/login') return 'login'
    if (path.startsWith('/app')) return 'app'
    if (path === '/admin') return 'admin'
    return 'loading'
  })
  const [currentPage, setCurrentPage] = useState(() => {
    const path = window.location.pathname.replace(/\/$/, '')
    if (path.startsWith('/app')) {
      const page = path.slice(4) || '/discover'
      if (page === '/matches') return 'matches'
      if (page === '/messages') return 'messages'
      if (page === '/likes') return 'likes'
      if (page === '/profile') return 'profile'
      return 'discover'
    }
    return 'discover'
  })
  const [user, setUser] = useState(null)
  const [authToken, setAuthToken] = useState(() => {
    const token = localStorage.getItem('authToken')
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
    return token
  })
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [notifications, setNotifications] = useState([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [discoverFilters, setDiscoverFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('discoverFilters')
      return saved ? JSON.parse(saved) : { minAge: 18, maxAge: 55, country: '', state: '', interests: [] }
    } catch {
      return { minAge: 18, maxAge: 55, country: '', state: '', interests: [] }
    }
  })
  const [step, setStep] = useState(1)
  const [message, setMessage] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [signup, setSignup] = useState({
    firstName: '', lastName: '', email: '', password: '', dob: '', country: '', stateRegion: '',
    interests: [], bio: '', profileFiles: [], selfieFile: null
  })

  useEffect(() => {
    const path = window.location.pathname.replace(/\/$/, '')
    if (path === '/signup') {
      setView('signup')
    } else if (path === '/login') {
      setView('login')
    }

    const handlePopState = () => {
      const currentPath = window.location.pathname.replace(/\/$/, '')
      if (currentPath === '/signup') {
        setView('signup')
      } else if (currentPath === '/login') {
        setView('login')
      } else if (currentPath.startsWith('/app')) {
        setView('app')
        const page = currentPath.slice(4) || '/discover'
        if (page === '/matches') return setCurrentPage('matches')
        if (page === '/messages') return setCurrentPage('messages')
        if (page === '/likes') return setCurrentPage('likes')
        if (page === '/profile') return setCurrentPage('profile')
        setCurrentPage('discover')
      } else {
        setView('login')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (authToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`
      fetchNotifications()
    } else {
      delete axios.defaults.headers.common['Authorization']
      setAuthLoading(false)
      return
    }
    fetchCurrentUser()
  }, [authToken])

  useEffect(() => {
    localStorage.setItem('discoverFilters', JSON.stringify(discoverFilters))
  }, [discoverFilters])

  const fetchNotifications = async () => {
    try {
      const res = await axios.get('/notifications')
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
      const res = await axios.get('/me')
      setUser(res.data.user || res.data)
      setView('app')
    } catch (err) {
      localStorage.removeItem('authToken')
      setAuthToken(null)
      setView('login')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const res = await axios.post('/login', { email: loginEmail, password: loginPassword })
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
    try { await axios.post('/logout') } catch (e) {}
    localStorage.removeItem('authToken')
    delete axios.defaults.headers.common['Authorization']
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
  const resetFaceVerification = () => {
    setFaceVerified(false)
    setFaceVerificationSkipped(false)
    setFaceVerifyResult(null)
  }
  const handleFileChange = (e) => {
    resetFaceVerification()
    handleSignupChange('profileFiles', Array.from(e.target.files || []))
  }
  const handleSelfieChange = (e) => {
    resetFaceVerification()
    handleSignupChange('selfieFile', e.target.files?.[0] || null)
  }
  const handleSelfieBlob = (file) => {
    resetFaceVerification()
    handleSignupChange('selfieFile', file)
  }
  const [faceVerifying, setFaceVerifying] = useState(false)
  const [faceVerifyResult, setFaceVerifyResult] = useState(null)
  const [faceVerified, setFaceVerified] = useState(false)
  const [faceVerificationSkipped, setFaceVerificationSkipped] = useState(false)

  const verifyFace = async () => {
    setFaceVerifying(true)
    setFaceVerifyResult(null)
    try {
      const profileFile = signup.profileFiles?.[0]
      const selfie = signup.selfieFile
      if (!profileFile || !selfie) {
        setFaceVerifyResult({ success: false, message: 'Profile photo and selfie are required for verification.' })
        setFaceVerifying(false)
        return
      }
      const fd = new FormData()
      fd.append('profile', profileFile)
      fd.append('selfie', selfie)
      const res = await axios.post('/verify/face', fd)
      const result = res.data || { success: false, message: 'No response' }
      setFaceVerifyResult(result)
      const passed = Boolean(result.success && result.match)
      setFaceVerified(passed)
      setFaceVerificationSkipped(false)
    } catch (err) {
      setFaceVerifyResult({ success: false, message: err.response?.data?.message || err.message })
      setFaceVerified(false)
      setFaceVerificationSkipped(false)
    } finally {
      setFaceVerifying(false)
    }
  }
  const goNext = () => setStep(s => Math.min(s + 1, 4))
  const goBack = () => setStep(s=>Math.max(s-1,1))
  const navigateAppPage = (page) => {
    setCurrentPage(page)
    window.history.pushState({}, '', `/app/${page}`)
  }

  const submitSignup = async () => {
    if (signup.profileFiles?.[0] && signup.selfieFile && !faceVerified && !faceVerificationSkipped) {
      setMessage('Please verify your face or skip verification before finishing signup.')
      return
    }

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
      signup.profileFiles?.forEach((file) => formData.append('photos', file))
      if (signup.selfieFile) formData.append('photos', signup.selfieFile)

      const res = await axios.post('/signup', formData)
      if (res.data?.success) {
        setMessage('Signup complete! Please log in.')
        setView('login')
        setStep(1)
        setSignup({ firstName:'', lastName:'', email:'', password:'', dob:'', country:'', stateRegion:'', interests:[], bio:'', profileFiles: [], selfieFile: null })
      } else {
        setMessage('Signup failed: ' + (res.data?.message || 'Please try again.'))
      }
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleSkipVerification = async () => {
    setFaceVerificationSkipped(true)
    await submitSignup()
  }

  const handleNext = async () => {
    if (step < 4) {
      goNext()
      return
    }
    await submitSignup()
  }

  const handleSignupSubmit = async (e) => {
    e.preventDefault()
    await handleNext()
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
        <p className="page-subtitle">Finish your profile in four quick steps.</p>
        <div className="step-indicator">Step {step} of 4</div>
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
              <div className="form-field">
                <label>Upload profile photos</label>
                <input type="file" accept="image/*" multiple onChange={handleFileChange}/>
                {signup.profileFiles && signup.profileFiles.length > 0 && <p className="file-note">Selected {signup.profileFiles.length} photo(s)</p>}
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <div className="form-field">
                <label>Face verification (optional)</label>
                <p className="hint">Please upload a selfie or capture one to verify your face matches your profile photo. You can skip this step.</p>
                <div className="form-field">
                  <label>Upload a selfie</label>
                  <input type="file" accept="image/*" onChange={handleSelfieChange} />
                  {signup.selfieFile && <p className="file-note">Selected selfie: {signup.selfieFile.name}</p>}
                </div>

                <div className="mt-3">
                  <FaceCapture onCapture={handleSelfieBlob} />
                </div>

                {signup.profileFiles && signup.profileFiles.length > 0 && (
                  <div className="preview" style={{marginTop:12}}>
                    <p className="hint">Profile photo to verify against:</p>
                    <img src={signup.profileFiles[0] ? URL.createObjectURL(signup.profileFiles[0]) : ''} alt="Profile preview" style={{maxWidth:200,borderRadius:12}} />
                  </div>
                )}

                <div className="mt-3">
                  <button type="button" className="secondary-button" onClick={verifyFace} disabled={faceVerifying}>{faceVerifying ? 'Verifying…' : 'Verify face'}</button>
                  <button type="button" className="secondary-button" onClick={handleSkipVerification} disabled={faceVerifying} style={{marginLeft:8}}>Skip verification</button>
                </div>

                {faceVerifyResult && (
                  <div style={{marginTop:10}}>
                    {faceVerifyResult.success ? (
                      <p style={{color: faceVerifyResult.match ? 'green' : 'orange'}}>{faceVerifyResult.match ? 'Face verification passed' : `Face mismatch (score ${faceVerifyResult.score?.toFixed ? faceVerifyResult.score.toFixed(3) : faceVerifyResult.score})`}</p>
                    ) : (
                      <p style={{color:'red'}}>Verification error: {faceVerifyResult.message}</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
          <div className="button-row">
            {step > 1 && <button type="button" className="secondary-button" onClick={goBack}>Back</button>}
            <button type="button" className="primary-button" onClick={handleNext} disabled={step === 4 && signup.profileFiles?.[0] && signup.selfieFile && !faceVerified && !faceVerificationSkipped}>
              {step < 4 ? 'Next' : 'Finish signup'}
            </button>
          </div>
        </form>
        <p className="page-note">Already have an account? <button type="button" className="button-link" onClick={() => { setView('login'); setMessage(''); window.history.pushState({}, '', '/') }}>Login</button></p>
        {message && <p className="form-message">{message}</p>}
      </div>
    </div>
  )

  return view === 'signup' ? signupView : authLoading ? (
    <div className="page-shell">
      <div className="page-card">
        <p className="page-subtitle">Loading...</p>
      </div>
    </div>
  ) : view === 'app' && user ? (() => {
    if (selectedMatch) return <Messaging user={user} match={selectedMatch} onBack={() => setSelectedMatch(null)} />

    const pageContent = currentPage === 'discover'
      ? <Discovery user={user} onMatch={refreshNotifications} showHeader={false} filters={discoverFilters} onDirectMessage={setSelectedMatch} />
      : currentPage === 'matches'
        ? <Matches user={user} onSelectMatch={setSelectedMatch} onLogout={handleLogout} />
        : currentPage === 'messages'
          ? <MessagesList user={user} onSelectMatch={setSelectedMatch} onLogout={handleLogout} />
          : currentPage === 'likes'
            ? <Likes />
            : <Profile user={user} onUpdateUser={setUser} onLogout={handleLogout} discoverFilters={discoverFilters} onUpdateDiscoverFilters={setDiscoverFilters} />

    return (
      <div className={`app-shell ${currentPage === 'discover' ? 'discover-shell' : ''}`}>
      <div className="top-right-profile">
        <button
          className={`profile-btn ${currentPage === 'profile' ? 'active' : ''}`}
          onClick={() => navigateAppPage('profile')}
          title="Profile"
        >
          {user && user.avatar ? <img src={resolveImageUrl(user.avatar)} alt={user.name || 'Profile'} /> : 'Profile'}
        </button>
      </div>
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
        <div className="page-content">
          {pageContent}
        </div>
        <div className="app-navigation">
          <button className={`nav-btn ${currentPage === 'discover' ? 'active' : ''}`} onClick={() => navigateAppPage('discover')}>Discover</button>
          <button className={`nav-btn ${currentPage === 'matches' ? 'active' : ''}`} onClick={() => navigateAppPage('matches')}>Matches</button>
          <button className={`nav-btn ${currentPage === 'messages' ? 'active' : ''}`} onClick={() => navigateAppPage('messages')}>Messages</button>
          <button className={`nav-btn ${currentPage === 'likes' ? 'active' : ''}`} onClick={() => navigateAppPage('likes')}>Likes</button>
        </div>
      </div>
    )
  })() : view === 'login' ? loginView : signupView
}

export default App
