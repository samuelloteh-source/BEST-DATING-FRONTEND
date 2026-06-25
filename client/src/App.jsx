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
import Admin from './admin'

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
  const [step, setStep] = useState(() => {
    const savedStep = Number(localStorage.getItem('signupStep') || 0)
    return savedStep >= 1 && savedStep <= 4 ? savedStep : 1
  })
  const [message, setMessage] = useState('')
  const [signupStepMessage, setSignupStepMessage] = useState('')
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
    localStorage.setItem('signupStep', String(step))
  }, [step])

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
    localStorage.removeItem('signupStep')
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
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationSuggested, setLocationSuggested] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [locationAutoDetected, setLocationAutoDetected] = useState(false)

  const getPasswordCriteria = (password) => ({
    length: password.length >= 10,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  })

  const passwordCriteria = getPasswordCriteria(signup.password || '')
  const passwordStrong = Object.values(passwordCriteria).every(Boolean)

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const fetchIpLocation = async () => {
    const ipResponse = await fetch('https://ipapi.co/json/')
    if (!ipResponse.ok) {
      throw new Error('IP location lookup failed.')
    }
    const ipData = await ipResponse.json()
    return {
      country: ipData.country_name || ipData.country || '',
      state: ipData.region || ipData.region_code || ipData.city || ''
    }
  }

  const reverseGeocode = async (latitude, longitude) => {
    // Try server-side proxy first (avoids client 401/CORS issues)
    try {
      const proxyRes = await fetch(`/api/reverse-geocode?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`)
      if (proxyRes.ok) {
        const json = await proxyRes.json()
        if (json && (json.country || json.state)) return { country: json.country || '', state: json.state || '' }
      } else {
        console.warn('Server reverse geocode proxy failed', proxyRes.status)
      }
    } catch (err) {
      console.warn('Server reverse geocode proxy error', err)
    }

    // Fallback to client-side providers
    const urls = [
      `https://geocode.maps.co/reverse?lat=${latitude}&lon=${longitude}`,
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
    ]
    for (const url of urls) {
      try {
        const response = await fetch(url, { headers: { Accept: 'application/json' } })
        if (!response.ok) {
          console.warn('Reverse geocode response not ok', url, response.status)
          continue
        }
        const data = await response.json()
        const country = data.address?.country || data.address?.country_code?.toUpperCase() || ''
        const state = data.address?.state || data.address?.region || data.address?.county || data.address?.city || ''
        if (country || state) {
          return { country, state }
        }
      } catch (err) {
        console.warn('Reverse geocode failed for', url, err)
      }
    }
    throw new Error('Reverse geocoding failed.')
  }

  const suggestLocation = async () => {
    setLocationError('')
    setLocationLoading(true)
    try {
      let country = ''
      let state = ''
      const secureContext = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

      if (secureContext && navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 15000 })
          })
          const { latitude, longitude } = position.coords
          const location = await reverseGeocode(latitude, longitude)
          country = location.country
          state = location.state
        } catch (geoErr) {
          console.warn('Geolocation/reverse geocode failed, falling back to IP lookup:', geoErr)
        }
      }

      if (!country && !state) {
        const ipLocation = await fetchIpLocation()
        country = country || ipLocation.country
        state = state || ipLocation.state
      }

      if (!country && !state) {
        throw new Error('Could not detect location automatically. Please enter it manually.')
      }

      if (country) handleSignupChange('country', country)
      if (state) handleSignupChange('stateRegion', state)
      setLocationSuggested(true)
      setLocationError('')
    } catch (err) {
      console.error('Location detect error', err)
      setLocationError(err.message || 'Unable to detect location.')
    } finally {
      setLocationLoading(false)
    }
  }

  useEffect(() => {
    if (step === 2 && !locationAutoDetected) {
      setLocationAutoDetected(true)
      suggestLocation()
    }
  }, [step, locationAutoDetected])

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
    console.log('verifyFace: started', { profileFiles: signup.profileFiles?.length || 0, hasSelfie: !!signup.selfieFile })
    try {
      const profileFile = signup.profileFiles?.[0]
      const selfieFile = signup.selfieFile
      if (!profileFile || !selfieFile) {
        setFaceVerifyResult({ success: false, message: 'Profile photo and selfie are required for verification.' })
        setFaceVerifying(false)
        return
      }

      // Load face-api from window
      if (!window.faceapi) {
        setFaceVerifyResult({ success: false, message: 'Face API not loaded. Please try again.' })
        setFaceVerifying(false)
        return
      }

      const faceapi = window.faceapi
      
      // Selfie must have descriptor from camera capture
      if (!selfieFile.descriptor) {
        setFaceVerifyResult({ success: false, message: 'Please capture selfie using camera (not file upload) for face detection.' })
        setFaceVerifying(false)
        return
      }

      // Load profile photo and detect face
      const profileUrl = URL.createObjectURL(profileFile)
      const profileImg = new Image()
      profileImg.crossOrigin = 'anonymous'
      
      await new Promise((resolve, reject) => {
        profileImg.onload = resolve
        profileImg.onerror = reject
        profileImg.src = profileUrl
      })

      const profileDetections = await faceapi.detectAllFaces(profileImg).withFaceLandmarks().withFaceDescriptors()
      if (!profileDetections || profileDetections.length === 0) {
        setFaceVerifyResult({ success: false, message: 'No face detected in profile photo. Please upload a clear photo of your face.' })
        setFaceVerifying(false)
        return
      }

      const profileDescriptor = profileDetections[0].descriptor

      // Compute euclidean distance between descriptors
      const distance = Math.sqrt(
        profileDescriptor.reduce((sum, v, i) => sum + Math.pow(v - selfieFile.descriptor[i], 2), 0)
      )
      const match = distance < 0.55
      const score = Math.max(0, 1 - distance)
      console.log('verifyFace: computed descriptors', { distance, match, score })

      // Send result to server for validation/logging
      console.log('verifyFace: sending to /verify/face')
      const res = await axios.post('/verify/face', { match, score, distance })
      console.log('verifyFace: /verify/face response status', res.status)
      const result = res.data || { success: false, message: 'No response' }
      console.log('verifyFace: /verify/face response data', result)
      setFaceVerifyResult(result)
      const passed = Boolean(result.success && result.match)
      setFaceVerified(passed)
      setFaceVerificationSkipped(false)
      URL.revokeObjectURL(profileUrl)
    } catch (err) {
      console.error('verifyFace error', err, err?.response?.data)
      setFaceVerifyResult({ success: false, message: err.response?.data?.message || err.message })
      setFaceVerified(false)
      setFaceVerificationSkipped(false)
    } finally {
      setFaceVerifying(false)
    }
  }
  const goNext = () => {
    setMessage('')
    setSignupStepMessage('')
    setStep(s => Math.min(s + 1, 4))
  }
  const goBack = () => {
    setMessage('')
    setSignupStepMessage('')
    setStep(s => Math.max(s - 1, 1))
  }
  const navigateAppPage = (page) => {
    setCurrentPage(page)
    window.history.pushState({}, '', `/app/${page}`)
  }

  const submitSignup = async () => {
    if (!isValidEmail(signup.email)) {
      setMessage('Please enter a valid email address before finishing signup.')
      return
    }

    if (!signup.profileFiles || signup.profileFiles.length === 0) {
      setMessage('Please upload at least one profile photo before finishing signup.')
      return
    }

    if (!signup.selfieFile) {
      setMessage('Please upload or capture a selfie before finishing signup.')
      return
    }

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
        localStorage.removeItem('signupStep')
        setStep(1)
        setSignup({ firstName:'', lastName:'', email:'', password:'', dob:'', country:'', stateRegion:'', interests:[], bio:'', profileFiles: [], selfieFile: null })
      } else {
        setMessage('Signup failed: ' + (res.data?.message || 'Please try again.'))
      }
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.message || err.message))
    }
  }

  const validateSignupStep = () => {
    setSignupStepMessage('')
    if (step === 1) {
      if (!isValidEmail(signup.email)) {
        setSignupStepMessage('Please enter a valid email address before continuing.')
        return false
      }
      if (!passwordStrong) {
        setSignupStepMessage('Password must be strong enough before continuing. Please meet all criteria.')
        return false
      }
    }
    if (step === 2) {
      if (!signup.dob || !signup.country.trim() || !signup.stateRegion.trim()) {
        setSignupStepMessage('Please complete all personal details before continuing.')
        return false
      }
      if (!signup.interests || signup.interests.length === 0) {
        setSignupStepMessage('Please select at least one interest before continuing.')
        return false
      }
    }
    if (step === 3) {
      if (!signup.bio.trim()) {
        setSignupStepMessage('Please enter a bio before continuing.')
        return false
      }
      if (!signup.profileFiles || signup.profileFiles.length === 0) {
        setSignupStepMessage('Please upload at least one profile photo before continuing.')
        return false
      }
    }
    if (step === 4) {
      if (!signup.selfieFile) {
        setSignupStepMessage('Please upload or capture a selfie before finishing signup.')
        return false
      }
    }
    setSignupStepMessage('')
    return true
  }

  const handleSkipVerification = async () => {
    if (!signup.selfieFile) {
      setMessage('Please upload or capture a selfie before skipping verification.')
      return
    }
    setFaceVerificationSkipped(true)
    await submitSignup()
  }

  const handleNext = async () => {
    if (!validateSignupStep()) return
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
        <p className="page-note">Don't have an account? <button type="button" className="button-link" onClick={() => { setView('signup'); setStep(1); setMessage(''); setSignupStepMessage(''); window.history.pushState({}, '', '/signup') }}>Signup</button></p>
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
        {message && <p className="form-message form-message--error">{message}</p>}
        <form className="form-card" onSubmit={handleSignupSubmit}>
          {step === 1 && (
            <>
              <div className="form-field"><label>First name</label><input type="text" value={signup.firstName} onChange={e=>handleSignupChange('firstName', e.target.value)} placeholder="First name" required/></div>
              <div className="form-field"><label>Last name</label><input type="text" value={signup.lastName} onChange={e=>handleSignupChange('lastName', e.target.value)} placeholder="Last name" required/></div>
              <div className="form-field"><label>Email</label><input type="email" value={signup.email} onChange={e=>handleSignupChange('email', e.target.value)} placeholder="you@example.com" required/></div>
              {signupStepMessage && <p className="form-message form-message--error">{signupStepMessage}</p>}
              <div className="form-field">
                <label>Password</label>
                <input
                  type="password"
                  value={signup.password}
                  onChange={e=>handleSignupChange('password', e.target.value)}
                  placeholder="Create a password"
                  required
                />
                <div className="password-criteria" style={{marginTop: 8, fontSize: '0.9rem', color: '#ccc'}}>
                  <div style={{color: passwordCriteria.length ? '#7ed957' : '#ff6b6b'}}>• At least 10 characters</div>
                  <div style={{color: passwordCriteria.upper ? '#7ed957' : '#ff6b6b'}}>• One uppercase letter</div>
                  <div style={{color: passwordCriteria.lower ? '#7ed957' : '#ff6b6b'}}>• One lowercase letter</div>
                  <div style={{color: passwordCriteria.number ? '#7ed957' : '#ff6b6b'}}>• One number</div>
                  <div style={{color: passwordCriteria.symbol ? '#7ed957' : '#ff6b6b'}}>• One symbol</div>
                </div>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="form-field"><label>Date of birth</label><input type="date" value={signup.dob} onChange={e=>handleSignupChange('dob', e.target.value)} required/></div>
              <div className="form-field">
                <label>Country</label>
                <input type="text" value={signup.country} onChange={e=>handleSignupChange('country', e.target.value)} placeholder="Country" required/>
              </div>
              <div className="form-field">
                <label>State or region</label>
                <input type="text" value={signup.stateRegion} onChange={e=>handleSignupChange('stateRegion', e.target.value)} placeholder="State or region" required/>
              </div>
              <div className="form-field" style={{marginTop: 8}}>
                <button type="button" className="secondary-button" onClick={suggestLocation} disabled={locationLoading}>
                  {locationLoading ? 'Detecting location…' : 'Auto detect my location'}
                </button>
                {locationError && <p className="hint" style={{color:'#d32f2f', marginTop: 6}}>{locationError}</p>}
                {locationSuggested && !locationLoading && <p className="hint" style={{marginTop: 6}}>Suggested location from browser. Edit if needed.</p>}
              </div>
              <div className="form-field"><label>Interests</label><div className="interests-list">{interestOptions.map(i=> (<button key={i} type="button" className={signup.interests.includes(i)?'interest-button active':'interest-button'} onClick={()=>toggleInterest(i)}>{i}</button>))}</div></div>
            </>
          )}
          {step === 3 && (
            <>
              <div className="form-field"><label>Bio</label><textarea value={signup.bio} onChange={e=>handleSignupChange('bio', e.target.value)} placeholder="Share something interesting about yourself" rows={5} required/></div>
              <div className="form-field">
                <label>Upload profile photos</label>
                <input type="file" accept="image/*" multiple onChange={handleFileChange} required />
                {signup.profileFiles && signup.profileFiles.length > 0 && <p className="file-note">Selected {signup.profileFiles.length} photo(s)</p>}
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <div className="form-field">
                <label>Face verification</label>
                <p className="hint">Please upload a selfie or capture one to verify your face matches your profile photo.</p>
                <div className="form-field">
                  <label>Upload a selfie</label>
                  <input type="file" accept="image/*" onChange={handleSelfieChange} required />
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
                  <button type="button" className="secondary-button" onClick={handleSkipVerification} disabled={faceVerifying || !signup.selfieFile} style={{marginLeft:8}}>Skip verification</button>
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

  if (view === 'admin') return <Admin />;

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
