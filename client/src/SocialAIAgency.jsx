import { useMemo, useState } from 'react'
import './SocialAIAgency.css'

const platformOptions = ['Instagram', 'TikTok', 'Facebook', 'LinkedIn']

const starterPosts = [
  {
    id: 1,
    platform: 'Instagram',
    caption: 'A calm story about confidence, growth, and showing up daily.',
    boost: '+14%',
    status: 'Queued',
  },
  {
    id: 2,
    platform: 'TikTok',
    caption: 'Short-form content that feels native and easy to share.',
    boost: '+11%',
    status: 'Scheduled',
  },
]

function SocialAIAgency() {
  const [connectedAccounts, setConnectedAccounts] = useState([
    { id: 'instagram', name: 'Instagram', followers: '16.2k', status: 'Connected' },
    { id: 'facebook', name: 'Facebook', followers: '8.4k', status: 'Connected' },
  ])
  const [selectedPlatform, setSelectedPlatform] = useState('Instagram')
  const [storyPrompt, setStoryPrompt] = useState('Write a warm story about a founder building a personal brand with calm confidence.')
  const [generatedStory, setGeneratedStory] = useState('A quiet sunrise, a coffee cup, and a bold new idea. This is the kind of story that feels personal and polished on any feed.')
  const [scheduleMode, setScheduleMode] = useState('Auto-post')
  const [posts, setPosts] = useState(starterPosts)
  const [automationState, setAutomationState] = useState('Active')

  const boostScore = useMemo(() => 82 + connectedAccounts.length * 4, [connectedAccounts.length])

  const connectAccount = (platform) => {
    setConnectedAccounts((prev) => {
      if (prev.some((account) => account.name === platform)) {
        return prev
      }
      return [...prev, { id: platform.toLowerCase(), name: platform, followers: 'New', status: 'Connected' }]
    })
    setSelectedPlatform(platform)
    setAutomationState('Connected and ready')
  }

  const generateStory = (event) => {
    event.preventDefault()

    const promptText = storyPrompt.trim() || 'Create a warm story about a founder building a personal brand.'
    const story = `“${promptText}” This AI-generated story is crafted to sound natural on ${selectedPlatform}, with a gentle call to action and a polished, human tone.`

    setGeneratedStory(story)
    setPosts((prev) => [
      {
        id: Date.now(),
        platform: selectedPlatform,
        caption: story,
        boost: `+${12 + connectedAccounts.length * 3}%`,
        status: 'Queued',
      },
      ...prev,
    ].slice(0, 4))
    setAutomationState('Story generated')
  }

  return (
    <div className="social-ai-shell">
      <header className="hero-panel">
        <nav className="top-nav">
          <div className="brand-mark">AutoSocial AI</div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#generator">Generator</a>
            <a href="#workflow">How it works</a>
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">AI social growth platform</p>
            <h1>Let your brand publish stories, grow its presence, and stay visible without constant effort.</h1>
            <p>
              Connect your social accounts, generate story-style content with AI, and let the platform publish it automatically while gently boosting reach.
            </p>
            <div className="hero-actions">
              <a href="#generator" className="primary-btn">Create your first story</a>
              <a href="#features" className="secondary-btn">View features</a>
            </div>
            <div className="hero-stats">
              <div>
                <strong>24/7</strong>
                <span>Content flow</span>
              </div>
              <div>
                <strong>+{boostScore}%</strong>
                <span>Boosted visibility</span>
              </div>
              <div>
                <strong>3 min</strong>
                <span>To launch a post</span>
              </div>
            </div>
          </div>

          <div className="hero-card">
            <div className="hero-card-head">
              <span>Live automation</span>
              <span className="status-pill">● {automationState}</span>
            </div>
            <div className="hero-card-body">
              <div className="metric-row">
                <span>Accounts linked</span>
                <strong>{connectedAccounts.length}</strong>
              </div>
              <div className="metric-row">
                <span>Next post</span>
                <strong>In 15 minutes</strong>
              </div>
              <div className="metric-row">
                <span>Engagement lift</span>
                <strong>+{boostScore - 40}%</strong>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="content-grid">
        <section className="card" id="features">
          <div className="card-title-row">
            <h2>Connect your socials</h2>
            <span className="mini-pill">Secure setup</span>
          </div>
          <div className="platform-buttons">
            {platformOptions.map((platform) => {
              const isConnected = connectedAccounts.some((account) => account.name === platform)
              return (
                <button
                  key={platform}
                  className={`platform-btn ${selectedPlatform === platform ? 'active' : ''}`}
                  onClick={() => connectAccount(platform)}
                >
                  {isConnected ? '✓ ' : ''}
                  {platform}
                </button>
              )
            })}
          </div>
          <div className="account-list">
            {connectedAccounts.map((account) => (
              <div key={account.id} className="account-item">
                <div>
                  <strong>{account.name}</strong>
                  <p>{account.followers} followers</p>
                </div>
                <span className="connected-badge">{account.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card" id="generator">
          <div className="card-title-row">
            <h2>Generate the story</h2>
            <span className="mini-pill">AI-powered</span>
          </div>
          <form onSubmit={generateStory} className="story-form">
            <label htmlFor="prompt">What should the story sound like?</label>
            <textarea
              id="prompt"
              value={storyPrompt}
              onChange={(event) => setStoryPrompt(event.target.value)}
              rows="4"
            />
            <div className="form-row">
              <select value={scheduleMode} onChange={(event) => setScheduleMode(event.target.value)}>
                <option value="Auto-post">Auto-post</option>
                <option value="Schedule later">Schedule later</option>
                <option value="Approve first">Approve first</option>
              </select>
              <button type="submit" className="primary-btn">Generate story</button>
            </div>
          </form>

          <div className="story-preview">
            <h3>Preview</h3>
            <p>{generatedStory}</p>
          </div>
        </section>

        <section className="card" id="workflow">
          <div className="card-title-row">
            <h2>Recent activity</h2>
            <span className="mini-pill">Boosting</span>
          </div>
          <div className="activity-list">
            {posts.map((post) => (
              <div key={post.id} className="activity-item">
                <div>
                  <strong>{post.platform}</strong>
                  <p>{post.caption}</p>
                </div>
                <div className="activity-meta">
                  <span>{post.status}</span>
                  <strong>{post.boost}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default SocialAIAgency
