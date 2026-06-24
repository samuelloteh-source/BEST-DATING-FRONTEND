import { useEffect, useState } from 'react'
import axios, { resolveImageUrl } from './api'
import './Likes.css'

export default function Likes() {
  const [likes, setLikes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchLikes()
  }, [])

  const fetchLikes = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await axios.get('/likes')
      setLikes(res.data.likes || [])
    } catch (err) {
      console.error('Failed to fetch likes:', err)
      setError('Unable to load likes right now.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="likes-container"><p>Loading who liked you...</p></div>
  }

  return (
    <div className="likes-container">
      <div className="likes-header">
        <div>
          <h1>Likes</h1>
          <p>See people who liked your profile.</p>
        </div>
      </div>

      {error && <div className="likes-error">{error}</div>}

      {likes.length === 0 ? (
        <div className="likes-empty">
          <p>No one has liked you yet.</p>
          <p>Keep swiping to discover new profiles.</p>
        </div>
      ) : (
        <div className="likes-grid">
          {likes.map((item) => (
            <div key={item.id} className="like-card">
              <div className="like-card-image">
                <img src={resolveImageUrl(item.photo) || 'https://via.placeholder.com/400x300?text=No+Photo'} alt={item.name} />
              </div>
              <div className="like-card-body">
                <div className="like-card-title">{item.name}</div>
                <div className="like-card-subtitle">{item.state || item.country ? `${item.state || ''}${item.state && item.country ? ', ' : ''}${item.country || ''}` : 'Location unavailable'}</div>
                <p className="like-card-bio">{item.bio || 'No bio available.'}</p>
                {item.isMatch ? <span className="like-badge">Matched</span> : <span className="like-badge">Liked you</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
