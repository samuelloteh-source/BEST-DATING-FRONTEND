import { useState, useEffect, useRef, useMemo } from 'react';
import axios, { apiBaseUrl, resolveImageUrl } from './api';
import io from 'socket.io-client';
import './Discovery.css';

const DEFAULT_FILTERS = {
  minAge: 18,
  maxAge: 55,
  country: '',
  state: '',
  interests: []
};

export default function Discovery({ user, onMatch, showHeader = true, filters, onDirectMessage }) {
  const [users, setUsers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [dragState, setDragState] = useState({ active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0, isSwiping: false });
  const [userOnlineStatus, setUserOnlineStatus] = useState({});
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const socketRef = useRef(null);
  const cardRef = useRef(null);
  const swipeThreshold = 100;

  useEffect(() => {
    fetchDiscoverUsers();
    
    // Initialize Socket.io connection
    const socket = io(apiBaseUrl, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('seed_user_status_changed', (data) => {
      setUserOnlineStatus(prev => ({
        ...prev,
        [data.userId]: data.isOnline
      }));
    });

    socket.on('connect', () => {
      socket.emit('request_status_check');
    });

    socket.on('status_check_response', (statuses) => {
      const statusMap = {};
      statuses.forEach(status => {
        statusMap[status.userId] = status.isOnline;
      });
      setUserOnlineStatus(statusMap);
    });

    return () => {
      if (socket) socket.disconnect();
    };
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

  const handleSuperLike = async () => {
    if (!currentUser) return;
    try {
      const response = await axios.post('/discover/superlike', { targetId: currentUser.id });
      if (response.data.isMatch) {
        setMessage('✨ Super like and match!');
        if (typeof onMatch === 'function') onMatch();
      } else {
        setMessage('✨ Super like sent!');
      }
      setTimeout(() => setMessage(''), 3000);
      moveToNextCard();
    } catch (err) {
      console.error('Failed to super like:', err);
    } finally {
      resetDrag();
    }
  };

  const interestOptions = ['Travel', 'Cooking', 'Music', 'Fitness', 'Movies', 'Reading', 'Art & Culture', 'Swimming', 'Hiking', 'Gym & Fitness', 'Sports', 'Foodie', 'Nature', 'Tech'];

  const ageFromDob = (dob) => {
    if (!dob) return 0;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    const dayDiff = today.getDate() - birth.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
    return age;
  };

  const filteredUsers = useMemo(() => {
    const activeFilters = filters || DEFAULT_FILTERS;
    return users.filter((candidate) => {
      const age = ageFromDob(candidate.dob);
      if (age < activeFilters.minAge || age > activeFilters.maxAge) return false;
      if (activeFilters.country && !String(candidate.country || '').toLowerCase().includes(activeFilters.country.toLowerCase())) return false;
      if (activeFilters.state && !String(candidate.state || '').toLowerCase().includes(activeFilters.state.toLowerCase())) return false;
      if (activeFilters.interests.length > 0) {
        const candidateInterests = Array.isArray(candidate.interests)
          ? candidate.interests.map((i) => String(i).toLowerCase())
          : [];
        const hasInterest = activeFilters.interests.some((interest) => candidateInterests.includes(interest.toLowerCase()));
        if (!hasInterest) return false;
      }
      return true;
    });
  }, [users, filters]);

  useEffect(() => {
    if (currentIndex >= filteredUsers.length) {
      setCurrentIndex(0);
    }
  }, [filteredUsers, currentIndex]);

  const currentUser = filteredUsers[currentIndex];

  const currentUserImage = resolveImageUrl(
    (currentUser?.gallery && currentUser.gallery.length > 0 && currentUser.gallery[0].url)
    || currentUser?.photo
  ) || 'https://via.placeholder.com/300x400?text=No+Photo';

  const resetDrag = () => setDragState({ active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0, isSwiping: false });

  const getEventPosition = (event) => {
    if (event.touches && event.touches.length > 0) {
      return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
    }
    if (event.changedTouches && event.changedTouches.length > 0) {
      return { clientX: event.changedTouches[0].clientX, clientY: event.changedTouches[0].clientY };
    }
    return { clientX: event.clientX, clientY: event.clientY };
  };

  const handlePointerDown = (event) => {
    if (event.target.closest('button')) return;
    const { clientX, clientY } = getEventPosition(event);
    setDragState({ active: true, startX: clientX, startY: clientY, offsetX: 0, offsetY: 0, isSwiping: false });
  };

  const handlePointerMove = (event) => {
    if (!dragState.active) return;
    const { clientX, clientY } = getEventPosition(event);
    setDragState((prev) => {
      const offsetX = clientX - prev.startX;
      const offsetY = clientY - prev.startY;
      const absX = Math.abs(offsetX);
      const absY = Math.abs(offsetY);
      const isSwiping = prev.isSwiping || (absX > absY && absX > 10);

      if (!isSwiping) {
        if (absY > absX && absY > 10) {
          return { active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0, isSwiping: false };
        }
        return prev;
      }

      event.preventDefault();
      return { ...prev, offsetX, offsetY, isSwiping };
    });
  };

  const handlePointerUp = () => {
    if (!dragState.active) return;
    if (dragState.isSwiping && Math.abs(dragState.offsetX) > swipeThreshold) {
      if (dragState.offsetX > 0) {
        handleLike();
      } else {
        handlePass();
      }
    } else {
      resetDrag();
    }
  };

  const moveToNextCard = () => {
    if (currentIndex < filteredUsers.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setMessage('No more users to discover');
      setTimeout(() => fetchDiscoverUsers(), 2000);
    }
  };

  const openProfileDetails = (profile) => {
    setSelectedProfile(profile);
    setProfileModalOpen(true);
  };

  const closeProfileDetails = () => {
    setProfileModalOpen(false);
    setSelectedProfile(null);
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
    transform: `translateX(${dragState.isSwiping ? dragState.offsetX : 0}px) rotate(${dragState.offsetX / 20}deg)`,
    transition: dragState.active ? 'none' : 'transform 0.25s ease',
  };

  return (
    <div className="discovery-container">
      {showHeader && (
        <div className="discovery-header">
          <div>
            <h1>Discover</h1>
            <p className="discovery-count">{filteredUsers.length} profiles available</p>
          </div>
          <div className="user-info">
            <span>{user.name}</span>
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
              src={currentUserImage}
              alt={currentUser.name}
            />
            <div className="card-overlay">
              <h2>{currentUser.name}, {currentUser.dob ? new Date().getFullYear() - new Date(currentUser.dob).getFullYear() : '?'}</h2>
              <p className="location">{currentUser.state || currentUser.city}, {currentUser.country}</p>
              {currentUser.id && currentUser.id.startsWith('seed_') && (
                <div className="online-badge">
                  <div className={`online-dot ${userOnlineStatus[currentUser.id] ? 'online' : 'offline'}`}></div>
                  <span>{userOnlineStatus[currentUser.id] ? 'Online' : 'Offline'}</span>
                </div>
              )}
              {currentUser.gallery && currentUser.gallery.length > 1 && (
                <div className="photo-count-badge">
                  <span>{currentUser.gallery.length} photos</span>
                </div>
              )}
            </div>
            <div className="card-actions-overlay">
              <button onClick={handlePass} className="pass-btn">
                <span>✕</span>
              </button>
              <button onClick={handleSuperLike} className="superlike-btn">
                <span>★</span>
              </button>
              <button onClick={handleLike} className="like-btn">
                <span>♥</span>
              </button>
            </div>
          </div>
          
          <div className="card-info">
            <p className="bio">
              {currentUser.bio
                ? `${currentUser.bio.slice(0, 100)}${currentUser.bio.length > 100 ? '...' : ''}`
                : 'No bio provided'}
            </p>
            {currentUser.interests && currentUser.interests.length > 0 && (
              <p className="profile-summary">
                Interests: {currentUser.interests.slice(0, 3).join(', ')}{currentUser.interests.length > 3 ? ` +${currentUser.interests.length - 3}` : ''}
              </p>
            )}
            <button type="button" className="view-profile-btn card-info-btn" onClick={() => openProfileDetails(currentUser)}>
              View full profile
            </button>
          </div>
        </div>
      </div>

      {profileModalOpen && selectedProfile && (
        <div className="profile-modal-backdrop" onClick={closeProfileDetails}>
          <div className="profile-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={closeProfileDetails}>×</button>
            <div className="profile-modal-image">
              <img src={resolveImageUrl((selectedProfile.gallery && selectedProfile.gallery.length > 0 && selectedProfile.gallery[0].url) || selectedProfile.photo) || 'https://via.placeholder.com/500x500?text=No+Photo'} alt={selectedProfile.name} />
            </div>
            {selectedProfile.gallery && selectedProfile.gallery.length > 1 && (
              <div className="gallery-thumbnails">
                {selectedProfile.gallery.slice(0, 4).map((image) => (
                  <img key={image.id} src={resolveImageUrl(image.url)} alt="Gallery thumbnail" className="gallery-thumbnail" />
                ))}
              </div>
            )}
            <div className="profile-modal-content">
              <h2>{selectedProfile.name}</h2>
              <p className="modal-location">{selectedProfile.state || selectedProfile.city || 'Unknown location'}, {selectedProfile.country || 'Unknown country'}</p>
              {selectedProfile.dob && <p className="modal-age">Age: {new Date().getFullYear() - new Date(selectedProfile.dob).getFullYear()}</p>}
              <h3>About</h3>
              <p>{selectedProfile.bio || 'No bio available.'}</p>
              {selectedProfile.interests && selectedProfile.interests.length > 0 && (
                <>
                  <h3>Interests</h3>
                  <div className="interest-tags modal-tags">
                    {selectedProfile.interests.map((interest, index) => (
                      <span key={index} className="interest-tag">{interest}</span>
                    ))}
                  </div>
                </>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="message-btn"
                  onClick={() => {
                    closeProfileDetails();
                    if (typeof onDirectMessage === 'function') onDirectMessage(selectedProfile);
                  }}
                >
                  Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
