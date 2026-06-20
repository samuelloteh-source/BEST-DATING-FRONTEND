import { useEffect, useState } from 'react'
import axios from './api'

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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    setForm({
      name: user.name || '',
      avatar: user.avatar || user.photo || '',
      bio: user.bio || '',
      interests: Array.isArray(user.interests) ? user.interests : []
    })
  }, [user])

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
    <div className="profile-page">
      <div className="profile-hero relative min-h-[320px] sm:min-h-[420px] overflow-hidden">
        <img
          src={user.avatar || user.photo || 'https://via.placeholder.com/1600x900?text=Profile+image'}
          alt={`${user.name} profile`}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative z-10 flex h-full items-end px-4 pb-8 sm:px-6 lg:px-8">
          <div className="max-w-5xl text-white">
            <p className="text-xs uppercase tracking-[0.28em] text-white/70">Profile</p>
            <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{user.name}</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/80">{user.bio || 'Your profile photo is the first impression. Keep it fresh and upbeat.'}</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-6 pb-6 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <section className="rounded-[32px] border border-white/15 bg-white/10 p-6 shadow-2xl shadow-black/10 backdrop-blur-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-3xl font-semibold text-white">Profile</h2>
                <p className="mt-2 text-sm text-slate-300">Manage your account and app preferences from one place.</p>
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
              <form onSubmit={handleSaveProfile} className="rounded-[32px] border border-white/10 bg-black/20 p-6 shadow-lg shadow-black/10 backdrop-blur-xl">
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

              <form onSubmit={handleChangePassword} className="rounded-[32px] border border-white/10 bg-black/20 p-6 shadow-lg shadow-black/10 backdrop-blur-xl">
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

              <form onSubmit={handleDeleteAccount} className="rounded-[32px] border border-red-500/25 bg-[#1f061a]/90 p-6 shadow-lg shadow-red-500/10 backdrop-blur-xl">
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