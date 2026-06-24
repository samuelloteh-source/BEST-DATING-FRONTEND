import { useState, useEffect } from 'react'
import axios, { resolveImageUrl } from './api'
import './MessagesList.css'

export default function MessagesList({ user, onSelectMatch, onLogout }) {
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchThreads()
  }, [])

  const fetchThreads = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.get('/messages/threads')
      setThreads(res.data.threads || [])
    } catch (err) {
      console.error('Failed to fetch message threads:', err)
      setError(err.response?.data?.message || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="conversations-container">
      <div className="conversations-header">
        <div>
          <h1>Messages</h1>
          <p>Only active conversations appear here.</p>
        </div>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </div>

      {loading ? (
        <div className="conversations-loading">Loading conversations...</div>
      ) : error ? (
        <div className="conversations-error">Error: {error}</div>
      ) : threads.length === 0 ? (
        <div className="no-conversations">
          <p>No conversations yet.</p>
          <p>Start messaging through the Matches page to create a thread.</p>
        </div>
      ) : (
        <div className="conversations-list">
          {threads.map((thread) => (
            <button
              key={thread.id}
              className="conversation-card"
              type="button"
              onClick={() => onSelectMatch(thread)}
            >
              <div className="conversation-avatar">
                <img src={resolveImageUrl(thread.photo) || 'https://via.placeholder.com/80?text=No+Photo'} alt={thread.name} />
              </div>
              <div className="conversation-details">
                <div className="conversation-top">
                  <h3>{thread.name}</h3>
                  {thread.lastTimestamp && (
                    <span className="conversation-time">
                      {new Date(thread.lastTimestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
                <p className="conversation-snippet">{thread.lastMessage || 'No message yet'}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
