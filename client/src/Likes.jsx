import { useEffect, useState } from 'react'
import axios, { resolveImageUrl } from './api'
import ImageModal from './ImageModal'
import './Likes.css'

export default function Likes() {
  const [likes, setLikes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [photoModal, setPhotoModal] = useState({ open: false, src: '' })

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
                <img
                  src={resolveImageUrl(item.photo)}
                  alt={item.name}
                  onError={(e) => { e.currentTarget.src = '/default-avatar.svg'; }}
                  className="cursor-pointer"
                  onClick={() => setPhotoModal({ open: true, src: resolveImageUrl(item.photo) })}
                />
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
      <ImageModal src={photoModal.src} alt="Liked user photo" open={photoModal.open} onClose={() => setPhotoModal({ open: false, src: '' })} />
    </div>
  )
}
