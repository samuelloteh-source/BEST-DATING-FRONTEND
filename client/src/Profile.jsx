import { useEffect, useState } from 'react'
import axios, { apiBaseUrl } from './api'

const interestOptions = [
  'Travel', 'Cooking', 'Music', 'Fitness', 'Movies', 'Reading', 'Art & Culture',
  'Swimming', 'Hiking', 'Gym & Fitness', 'Sports', 'Foodie', 'Nature', 'Tech',
]
const MAX_INTERESTS = 5

export default function Profile({ user, onUpdateUser, onLogout, discoverFilters = { minAge: 18, maxAge: 55, country: '', state: '', interests: [] }, onUpdateDiscoverFilters }) {
  const [form, setForm] = useState({ name: '', avatar: '', bio: '', interests: [] })
  const [settingsTab, setSettingsTab] = useState('profile')
  const [filterForm, setFilterForm] = useState(discoverFilters)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [profileVisibility, setProfileVisibility] = useState('Everyone')
  const [message, setMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [deleteMessage, setDeleteMessage] = useState('')
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [deletePassword, setDeletePassword] = useState('')
  const [showProfileEditor, setShowProfileEditor] = useState(false)
  const [showPasswordEditor, setShowPasswordEditor] = useState(false)
  const [loading, setLoading] = useState(false)
  const [gallery, setGallery] = useState([])
  const [galleryUploading, setGalleryUploading] = useState(false)
  const [galleryMessage, setGalleryMessage] = useState('')

  const resolveImageUrl = (url) => {
    if (!url) return ''
    if (typeof url === 'string' && url.startsWith('/uploads/')) {
      return `${apiBaseUrl}${url}`
    }
    return url
  }

  useEffect(() => {
    if (!user) return
    setForm({
      name: user.name || '',
      avatar: user.avatar || user.photo || '',
      bio: user.bio || '',
      interests: Array.isArray(user.interests) ? user.interests : []
    })
    setGallery(Array.isArray(user.gallery) ? user.gallery : [])
    fetchGallery()
  }, [user])

  const fetchGallery = async () => {
    try {
      const res = await axios.get('/profile/gallery')
      if (res.data?.success) {
        setGallery(res.data.gallery || [])
      }
    } catch (err) {
      console.error('Failed to load gallery:', err)
    }
  }

  const uploadGalleryFiles = async (files) => {
    if (!files || files.length === 0) return
    setGalleryMessage('')
    setGalleryUploading(true)

    try {
      const uploadedImages = []
      for (const file of files) {
        const formData = new FormData()
        formData.append('image', file)
        const res = await axios.post('/profile/gallery', formData)
        if (res.data?.success) {
          uploadedImages.push(res.data.image)
        }
      }
      if (uploadedImages.length) {
        // Verify by re-fetching the gallery from the server to ensure backend saved files
        await fetchGallery()
        setGalleryMessage(`Added ${uploadedImages.length} photo${uploadedImages.length === 1 ? '' : 's'} to your gallery.`)
      }
    } catch (err) {
      console.error('Gallery upload failed:', err)
      setGalleryMessage('Could not upload photos. Please try again.')
    } finally {
      setGalleryUploading(false)
    }
  }

  const handleGalleryFileChange = (event) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return
    uploadGalleryFiles(files)
    event.target.value = null
  }

  const handleDeleteGalleryImage = async (imageId) => {
    if (!imageId) return
    try {
      const res = await axios.delete(`/profile/gallery/${imageId}`)
      if (res.data?.success) {
        setGallery((prev) => prev.filter((image) => image.id !== imageId))
        setGalleryMessage('Photo removed from your gallery.')
      }
    } catch (err) {
      console.error('Failed to delete gallery image:', err)
      setGalleryMessage('Could not remove photo. Please try again.')
    }
  }

  useEffect(() => {
    setFilterForm(discoverFilters)
  }, [discoverFilters])

  const handleFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const toggleInterest = (interest) => {
    setForm(prev => {
      const hasInterest = prev.interests.includes(interest)
      const nextInterests = hasInterest
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest].slice(0, MAX_INTERESTS)
      return { ...prev, interests: nextInterests }
    })
  }

  const handleSaveProfile = async (event) => {
    event.preventDefault()
    setMessage('')
    setPasswordMessage('')
    setDeleteMessage('')
    setLoading(true)

    try {
      const payload = {
        name: form.name,
        avatar: form.avatar,
        bio: form.bio,
        interests: form.interests
      }
      const res = await axios.put('/api/user/profile', payload)
      if (res.data?.success) {
        onUpdateUser(res.data.user)
        setMessage('Profile updated successfully.')
      } else {
        setMessage(res.data?.message || 'Unable to update profile.')
      }
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (event) => {
    event.preventDefault()
    setPasswordMessage('')
    setMessage('')
    setDeleteMessage('')

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordMessage('Both current and new password are required.')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage('New password and confirmation must match.')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordMessage('New password must be at least 8 characters long.')
      return
    }

    setLoading(true)
    try {
      const res = await axios.put('/api/user/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      if (res.data?.success) {
        setPasswordMessage('Password changed successfully.')
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        setPasswordMessage(res.data?.message || 'Unable to change password.')
      }
    } catch (err) {
      setPasswordMessage('Error: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async (event) => {
    event.preventDefault()
    setDeleteMessage('')
    setMessage('')
    setPasswordMessage('')

    if (!deletePassword) {
      setDeleteMessage('Please confirm your password before deleting your account.')
      return
    }
    if (!window.confirm('This action is permanent. Delete your account?')) {
      return
    }

    setLoading(true)
    try {
      const res = await axios.delete('/api/user/account', { data: { password: deletePassword } })
      if (res.data?.success) {
        onLogout()
      } else {
        setDeleteMessage(res.data?.message || 'Unable to delete account.')
      }
    } catch (err) {
      setDeleteMessage('Error: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (field, value) => {
    setFilterForm(prev => ({ ...prev, [field]: value }))
  }

  const handleInterestToggle = (interest) => {
    setFilterForm(prev => {
      const nextInterests = prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest].slice(0, 5)
      return { ...prev, interests: nextInterests }
    })
  }

  const saveDiscoverFilters = () => {
    if (typeof onUpdateDiscoverFilters === 'function') {
      onUpdateDiscoverFilters(filterForm)
    }
    setMessage('Discover settings saved.')
  }

  return (
    <div className="profile-page" style={{ backgroundColor: '#1a1a1a' }}>
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-6 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <section className="rounded-[32px] border border-white/15 bg-white/10 p-6 shadow-2xl shadow-black/10 backdrop-blur-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-3xl font-semibold text-white">Profile settings</h2>
                <p className="mt-2 text-sm text-slate-300">Update your profile and account preferences in one place.</p>
              </div>
              <div className="flex flex-col gap-2 text-right text-sm text-slate-300">
                <span>{user.email}</span>
                <span>Member since {new Date(user.created_at || Date.now()).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2 justify-between">
              <div className="flex gap-2 flex-wrap">
                <button type="button" className={`rounded-full px-4 py-2 text-sm ${settingsTab === 'profile' ? 'bg-pink-500 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/20'}`} onClick={() => setSettingsTab('profile')}>Profile</button>
                <button type="button" className={`rounded-full px-4 py-2 text-sm ${settingsTab === 'settings' ? 'bg-pink-500 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/20'}`} onClick={() => setSettingsTab('settings')}>Settings</button>
              </div>
              <button type="button" onClick={onLogout} className="rounded-full px-4 py-2 text-sm bg-red-500 text-white hover:bg-red-400">Logout</button>
            </div>
          </section>

          {settingsTab === 'profile' ? (
            <>
              <div className="rounded-[32px] border border-white/10 bg-black/20 p-6 shadow-lg shadow-black/10 backdrop-blur-xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold text-white">Profile overview</h3>
                    <p className="mt-2 text-sm text-slate-300">Tap the button to edit your profile details.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProfileEditor((prev) => !prev)}
                    className="inline-flex items-center justify-center rounded-3xl bg-gradient-to-r from-pink-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition hover:scale-[1.01]"
                  >
                    {showProfileEditor ? 'Hide profile editor' : 'Edit profile details'}
                  </button>
                </div>
              </div>

              {showProfileEditor && (
                <form onSubmit={handleSaveProfile} className="mt-6 rounded-[32px] border border-white/10 bg-black/20 p-6 shadow-lg shadow-black/10 backdrop-blur-xl">
                  <h3 className="text-2xl font-semibold text-white">Profile details</h3>
                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-300">
                      <span>Name</span>
                      <input
                        value={form.name}
                        onChange={(e) => handleFormChange('name', e.target.value)}
                        className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-pink-400"
                        placeholder="Your full name"
                        required
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                      <span>Avatar URL</span>
                      <input
                        value={form.avatar}
                        onChange={(e) => handleFormChange('avatar', e.target.value)}
                        className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-pink-400"
                        placeholder="https://"
                      />
                    </label>
                  </div>

                  <label className="mt-5 block text-sm text-slate-300">
                    <span>About you</span>
                    <textarea
                      value={form.bio}
                      onChange={(e) => handleFormChange('bio', e.target.value)}
                      className="mt-2 h-32 w-full rounded-[28px] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-pink-400"
                      placeholder="Tell your next match what makes you unique."
                    />
                  </label>

                  <div className="mt-5">
                    <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Interests</div>
                    <div className="flex flex-wrap gap-2">
                      {interestOptions.map((interest) => {
                        const active = form.interests.includes(interest)
                        return (
                          <button
                            type="button"
                            key={interest}
                            className={`rounded-full px-4 py-2 text-sm transition ${active ? 'bg-pink-500 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/20'}`}
                            onClick={() => toggleInterest(interest)}
                          >
                            {interest}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">Select up to {MAX_INTERESTS} interests.</p>
                  </div>

                  <div className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-lg font-semibold text-white">Photo gallery</h4>
                        <p className="mt-1 text-sm text-slate-400">Upload more pictures to your profile gallery.</p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{gallery.length} photos</span>
                    </div>

                    <label className="mt-4 block text-sm text-slate-300">
                      <span className="mb-2 block">Add photos</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={galleryUploading}
                        onChange={handleGalleryFileChange}
                        className="w-full rounded-3xl border border-white/10 bg-black/80 px-4 py-3 text-white outline-none"
                      />
                    </label>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {gallery.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-white/15 bg-black/40 p-5 text-sm text-slate-400">No gallery photos yet.</div>
                      ) : (
                        gallery.map((image) => (
                          <div key={image.id} className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950">
                            <img src={resolveImageUrl(image.url)} alt="Gallery" className="h-28 w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleDeleteGalleryImage(image.id)}
                              className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white transition hover:bg-black"
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {galleryMessage && <p className="mt-3 text-sm text-emerald-300">{galleryMessage}</p>}
                    {galleryUploading && <p className="mt-3 text-sm text-slate-400">Uploading photos…</p>}
                  </div>

                  <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center justify-center rounded-3xl bg-gradient-to-r from-pink-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Save profile
                    </button>
                    {message && <p className="text-sm text-emerald-300">{message}</p>}
                  </div>
                </form>
              )}

              <div className="mt-6 rounded-[32px] border border-white/10 bg-black/20 p-6 shadow-lg shadow-black/10 backdrop-blur-xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold text-white">Password</h3>
                    <p className="mt-2 text-sm text-slate-300">Only open this section when you want to update your password.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPasswordEditor((prev) => !prev)}
                    className="inline-flex items-center justify-center rounded-3xl bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    {showPasswordEditor ? 'Hide password editor' : 'Change password'}
                  </button>
                </div>
              </div>

              {showPasswordEditor && (
                <form onSubmit={handleChangePassword} className="mt-6 rounded-[32px] border border-white/10 bg-black/20 p-6 shadow-lg shadow-black/10 backdrop-blur-xl">
                  <h3 className="text-2xl font-semibold text-white">Change password</h3>
                  <div className="mt-6 grid gap-5 sm:grid-cols-3">
                    <label className="space-y-2 text-sm text-slate-300">
                      <span>Current password</span>
                      <input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                        className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                        required
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                      <span>New password</span>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                        required
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                      <span>Confirm new</span>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                        required
                      />
                    </label>
                  </div>
                  <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center justify-center rounded-3xl bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Save password
                    </button>
                    {passwordMessage && <p className="text-sm text-slate-300">{passwordMessage}</p>}
                  </div>
                </form>
              )}

              <form onSubmit={handleDeleteAccount} className="mt-6 rounded-[32px] border border-red-500/25 bg-[#1f061a]/90 p-6 shadow-lg shadow-red-500/10 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-semibold text-white">Delete account</h3>
                    <p className="mt-2 text-sm text-rose-200/80">Deleting your account removes your profile and same-day matches permanently.</p>
                  </div>
                  <span className="rounded-full border border-red-500/60 bg-red-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-red-300">Danger zone</span>
                </div>

                <label className="mt-6 block space-y-2 text-sm text-slate-300">
                  <span>Confirm password</span>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                    placeholder="Enter your password"
                    required
                  />
                </label>

                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-3xl bg-gradient-to-r from-red-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete account
                  </button>
                  {deleteMessage && <p className="text-sm text-rose-200">{deleteMessage}</p>}
                </div>
              </form>
            </>
          ) : (
            <section className="rounded-[32px] border border-white/10 bg-black/20 p-6 shadow-lg shadow-black/10 backdrop-blur-xl">
              <h3 className="text-2xl font-semibold text-white">Settings</h3>
              <p className="mt-2 text-sm text-slate-300">Control your discovery preferences, notifications, and privacy.</p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Min age</span>
                  <input
                    type="number"
                    min="18"
                    max="100"
                    value={filterForm.minAge}
                    onChange={(e) => handleFilterChange('minAge', Number(e.target.value))}
                    className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Max age</span>
                  <input
                    type="number"
                    min="18"
                    max="100"
                    value={filterForm.maxAge}
                    onChange={(e) => handleFilterChange('maxAge', Number(e.target.value))}
                    className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                  />
                </label>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Country</span>
                  <input
                    type="text"
                    value={filterForm.country}
                    onChange={(e) => handleFilterChange('country', e.target.value)}
                    className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                    placeholder="Country"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>State / region</span>
                  <input
                    type="text"
                    value={filterForm.state}
                    onChange={(e) => handleFilterChange('state', e.target.value)}
                    className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                    placeholder="State or region"
                  />
                </label>
              </div>

              <div className="mt-5">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Interests</div>
                <div className="flex flex-wrap gap-2">
                  {interestOptions.map((interest) => {
                    const active = filterForm.interests.includes(interest)
                    return (
                      <button
                        type="button"
                        key={interest}
                        className={`rounded-full px-4 py-2 text-sm transition ${active ? 'bg-pink-500 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/20'}`}
                        onClick={() => handleInterestToggle(interest)}
                      >
                        {interest}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-400">Select up to 5 interests for discovery.</p>
              </div>

              <div className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                <h4 className="mb-2 text-base font-semibold text-white">Privacy & notifications</h4>
                <div className="flex items-center justify-between gap-3 py-2">
                  <span>Email notifications</span>
                  <button type="button" className={`rounded-full px-4 py-2 text-sm ${notificationsEnabled ? 'bg-pink-500 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/20'}`} onClick={() => setNotificationsEnabled(prev => !prev)}>{notificationsEnabled ? 'Enabled' : 'Disabled'}</button>
                </div>
                <div className="flex items-center justify-between gap-3 py-2">
                  <span>Profile visibility</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">{profileVisibility}</span>
                </div>
                <p className="mt-3 text-xs text-slate-400">Settings here affect who you see and how your profile appears to matches.</p>
              </div>

              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={saveDiscoverFilters} className="inline-flex items-center justify-center rounded-3xl bg-gradient-to-r from-pink-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition hover:scale-[1.01]">
                  Save settings
                </button>
                {message && <p className="text-sm text-emerald-300">{message}</p>}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}