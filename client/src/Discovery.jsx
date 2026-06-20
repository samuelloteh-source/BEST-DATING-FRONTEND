import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Discovery.css';

export default function Discovery({ user, onLogout, onMatch, showHeader = true }) {
  const [users, setUsers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [dragState, setDragState] = useState({ active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 });
  const cardRef = useRef(null);
  const swipeThreshold = 100;

  useEffect(() => {
    fetchDiscoverUsers();
  }, []);

  const fetchDiscoverUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/discover');
      setUsers(response.data.users || []);
      setCurrentIndex(0);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setMessage('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const currentUser = users[currentIndex];

  const resetDrag = () => setDragState({ active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 });

  const handleLike = async () => {
    if (!currentUser) return;
    try {
      const response = await axios.post('/discover/like', { targetId: currentUser.id });
      if (response.data.isMatch) {
        setMessage('🎉 It\'s a match!');
        if (typeof onMatch === 'function') onMatch();
        setTimeout(() => setMessage(''), 3000);
      }
      moveToNextCard();
    } catch (err) {
      console.error('Failed to like:', err);
    } finally {
      resetDrag();
    }
  };

  const handlePass = async () => {
    if (!currentUser) return;
    try {
      await axios.post('/discover/pass', { targetId: currentUser.id });
      moveToNextCard();
    } catch (err) {
      console.error('Failed to pass:', err);
    } finally {
      resetDrag();
    }
  };

  const handlePointerDown = (event) => {
    if (event.target.closest('button')) return;
    event.preventDefault();
    cardRef.current?.setPointerCapture(event.pointerId);
    setDragState({ active: true, startX: event.clientX, startY: event.clientY, offsetX: 0, offsetY: 0 });
  };

  const handlePointerMove = (event) => {
    if (!dragState.active) return;
    setDragState(prev => ({
      ...prev,
      offsetX: event.clientX - prev.startX,
      offsetY: event.clientY - prev.startY
    }));
  };

  const handlePointerUp = () => {
    if (!dragState.active) return;
    if (dragState.offsetX > swipeThreshold) {
      handleLike();
    } else if (dragState.offsetX < -swipeThreshold) {
      handlePass();
    } else {
      resetDrag();
    }
  };

  const moveToNextCard = () => {
    if (currentIndex < users.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setMessage('No more users to discover');
      setTimeout(() => fetchDiscoverUsers(), 2000);
    }
  };

  if (loading) {
    return <div className="discovery-container"><p>Loading profiles...</p></div>;
  }

  if (!currentUser) {
    return (
      <div className="discovery-container">
        <p>No more users to discover</p>
        <button onClick={fetchDiscoverUsers} className="primary-button">Refresh</button>
      </div>
    );
  }

  const cardTransform = {
    transform: `translate(${dragState.offsetX}px, ${dragState.offsetY}px) rotate(${dragState.offsetX / 20}deg)`,
    transition: dragState.active ? 'none' : 'transform 0.25s ease',
  };

  return (
    <div className="discovery-container">
      {showHeader && (
        <div className="discovery-header">
          <div>
            <h1>Discover</h1>
            <p className="discovery-count">{users.length} profiles available</p>
          </div>
          <div className="user-info">
            <span>{user.name}</span>
            <button onClick={onLogout} className="logout-btn">Logout</button>
          </div>
        </div>
      )}

      {message && <div className="match-message">{message}</div>}

      <div className="card-stack">
        <div
          className={`discovery-card ${dragState.active ? 'dragging' : ''}`}
          ref={cardRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={cardTransform}
        >
          <div className="card-image">
            <img 
              src={currentUser.photo || 'https://via.placeholder.com/300x400?text=No+Photo'} 
              alt={currentUser.name}
            />
            <div className="card-overlay">
              <h2>{currentUser.name}, {currentUser.dob ? new Date().getFullYear() - new Date(currentUser.dob).getFullYear() : '?'}</h2>
              <p className="location">{currentUser.city || currentUser.state}, {currentUser.country}</p>
            </div>
            <div className="card-actions-overlay">
              <button onClick={handlePass} className="pass-btn">
                <span>✕</span>
              </button>
              <button onClick={handleLike} className="like-btn">
                <span>♥</span>
              </button>
            </div>
          </div>
          
          <div className="card-info">
            <p className="bio">{currentUser.bio || 'No bio provided'}</p>
            {currentUser.interests && currentUser.interests.length > 0 && (
              <div className="interests">
                <strong>Interests:</strong>
                <div className="interest-tags">
                  {currentUser.interests.map((interest, i) => (
                    <span key={i} className="interest-tag">{interest}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card-counter">
        {currentIndex + 1} / {users.length}
      </div>
    </div>
  );
}
