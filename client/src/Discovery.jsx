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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function Discovery({ user, onMatch, showHeader = true, filters, onDirectMessage }) {
  const [users, setUsers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [dragState, setDragState] = useState({ active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0, isSwiping: false });
  const [swipeOutcome, setSwipeOutcome] = useState(null);
  const [userOnlineStatus, setUserOnlineStatus] = useState({});
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const socketRef = useRef(null);
  const swipeTimeoutRef = useRef(null);

  useEffect(() => {
    fetchDiscoverUsers();

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
      statuses.forEach((status) => {
        statusMap[status.userId] = status.isOnline;
      });
      setUserOnlineStatus(statusMap);
    });

    return () => {
      if (socket) socket.disconnect();
      if (swipeTimeoutRef.current) window.clearTimeout(swipeTimeoutRef.current);
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

  const vibrate = (pattern) => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const playFeedback = (type) => {
    if (typeof window === 'undefined') return;
    if (type === 'like') vibrate(10);
    if (type === 'pass') vibrate(12);
    if (type === 'superlike') vibrate([12, 18, 24]);
  };

  const handleLike = async () => {
    if (!currentUser) return;
    const targetId = currentUser.id;
    moveToNextCard();
    resetDrag();

    try {
      const response = await axios.post('/discover/like', { targetId });
      if (response.data.isMatch) {
        setMessage('🎉 It\'s a match!');
        if (typeof onMatch === 'function') onMatch();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      console.error('Failed to like:', err);
      setMessage('Could not record your like. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handlePass = async () => {
    if (!currentUser) return;
    const targetId = currentUser.id;
    moveToNextCard();
    resetDrag();

    try {
      await axios.post('/discover/pass', { targetId });
    } catch (err) {
      console.error('Failed to pass:', err);
      setMessage('Could not record your pass. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleSuperLike = async () => {
    if (!currentUser) return;
    const targetId = currentUser.id;
    moveToNextCard();
    resetDrag();

    try {
      const response = await axios.post('/discover/superlike', { targetId });
      if (response.data.isMatch) {
        setMessage('✨ Super like and match!');
        if (typeof onMatch === 'function') onMatch();
      } else {
        setMessage('✨ Super like sent!');
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Failed to super like:', err);
      setMessage('Could not record your super like. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const triggerSwipeAction = (direction, action) => {
    const width = window.innerWidth || 375;
    const height = window.innerHeight || 700;

    let outcome = { x: 0, y: 0, rotate: 0, scale: 1 };
    if (direction === 'like') {
      outcome = { x: width * 1.2, y: -18, rotate: 16, scale: 1 };
      playFeedback('like');
    } else if (direction === 'pass') {
      outcome = { x: -width * 1.2, y: 12, rotate: -16, scale: 1 };
      playFeedback('pass');
    } else if (direction === 'superlike') {
      outcome = { x: 0, y: -height * 1.05, rotate: 0, scale: 0.95 };
      playFeedback('superlike');
    }

    setSwipeOutcome(outcome);
    if (swipeTimeoutRef.current) window.clearTimeout(swipeTimeoutRef.current);
    swipeTimeoutRef.current = window.setTimeout(() => {
      setSwipeOutcome(null);
      action();
    }, 220);
  };

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
  const stackUsers = filteredUsers.slice(currentIndex, currentIndex + 3);

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
      const isHorizontal = absX > absY + 8 && absX > 12;
      const isVerticalUp = absY > absX + 8 && absY > 12 && offsetY < 0;
      const isSwiping = prev.isSwiping || isHorizontal || isVerticalUp;

      if (!isSwiping) {
        if (absY > absX && absY > 10) {
          return { active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0, isSwiping: false };
        }
        return prev;
      }

      event.preventDefault();
      if (isVerticalUp) {
        return { ...prev, offsetX: offsetX * 0.2, offsetY, isSwiping: true };
      }
      return { ...prev, offsetX, offsetY, isSwiping: true };
    });
  };

  const handlePointerUp = () => {
    if (!dragState.active) return;

    const width = window.innerWidth || 375;
    const height = window.innerHeight || 700;
    const thresholdX = Math.max(90, width * 0.3);
    const thresholdY = Math.max(110, height * 0.35);

    if (dragState.isSwiping) {
      if (dragState.offsetY < -thresholdY && Math.abs(dragState.offsetY) > Math.abs(dragState.offsetX) * 1.1) {
        triggerSwipeAction('superlike', handleSuperLike);
      } else if (dragState.offsetX > thresholdX) {
        triggerSwipeAction('like', handleLike);
      } else if (dragState.offsetX < -thresholdX) {
        triggerSwipeAction('pass', handlePass);
      } else {
        resetDrag();
      }
      return;
    }

    resetDrag();
  };

  const moveToNextCard = () => {
    if (currentIndex < filteredUsers.length - 1) {
      setCurrentIndex((prev) => prev + 1);
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

  const topCardStyle = () => {
    const dragX = dragState.isSwiping ? dragState.offsetX : 0;
    const dragY = dragState.isSwiping ? dragState.offsetY : 0;
    const rotation = dragState.isSwiping ? clamp(dragX / 18, -15, 15) : 0;
    const scale = dragState.isSwiping && dragY < -20 ? 0.95 : 1;

    if (swipeOutcome) {
      return {
        transform: `translate(${swipeOutcome.x}px, ${swipeOutcome.y}px) rotate(${swipeOutcome.rotate}deg) scale(${swipeOutcome.scale})`,
        transition: 'transform 220ms cubic-bezier(0.2, 0.85, 0.3, 1)',
        boxShadow: '0 34px 90px rgba(0, 0, 0, 0.42)'
      };
    }

    const shadowIntensity = clamp((Math.abs(dragX) + Math.abs(dragY)) / 220, 0, 1);
    return {
      transform: `translate(${dragX}px, ${dragY}px) rotate(${rotation}deg) scale(${scale})`,
      transition: dragState.active ? 'none' : 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
      boxShadow: `0 ${28 + shadowIntensity * 24}px ${82 + shadowIntensity * 26}px rgba(0, 0, 0, ${0.35 + shadowIntensity * 0.16})`
    };
  };

  const likeBadgeOpacity = dragState.isSwiping ? clamp(Math.abs(dragState.offsetX) / 140, 0.1, 1) : 0;
  const passBadgeOpacity = dragState.isSwiping ? clamp(Math.abs(dragState.offsetX) / 140, 0.1, 1) : 0;
  const superBadgeOpacity = dragState.isSwiping ? clamp(Math.abs(dragState.offsetY) / 160, 0.1, 1) : 0;
  const showLikeBadge = dragState.isSwiping && dragState.offsetX > 20;
  const showPassBadge = dragState.isSwiping && dragState.offsetX < -20;
  const showSuperBadge = dragState.isSwiping && dragState.offsetY < -20 && Math.abs(dragState.offsetY) > Math.abs(dragState.offsetX);

  const renderProfileCard = (profile, isTopCard = false, index = 0) => {
    if (!profile) return null;

    const profileImage = resolveImageUrl(
      (profile.gallery && profile.gallery.length > 0 && profile.gallery[0].url)
      || profile.photo
    );

    const cardClassName = isTopCard ? 'discovery-card top-card' : 'discovery-card stack-card';
    const stackStyle = isTopCard
      ? topCardStyle()
      : {
          transform: `translateY(${16 + index * 12}px) scale(${1 - index * 0.04})`,
          opacity: 1 - index * 0.08,
          transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease'
        };

    return (
      <div
        key={profile.id || `${profile.email}-${index}`}
        className={cardClassName}
        onPointerDown={isTopCard ? handlePointerDown : undefined}
        onPointerMove={isTopCard ? handlePointerMove : undefined}
        onPointerUp={isTopCard ? handlePointerUp : undefined}
        onPointerCancel={isTopCard ? handlePointerUp : undefined}
        style={isTopCard ? { ...stackStyle, zIndex: 3 } : { ...stackStyle, zIndex: 3 - index }}
      >
        <div className="card-image">
          <img src={profileImage} alt={profile.name} onError={(e) => { e.currentTarget.src = '/default-avatar.svg'; }} />
          <div className="card-overlay">
            <h2>{profile.name}, {profile.dob ? new Date().getFullYear() - new Date(profile.dob).getFullYear() : '?'}</h2>
            <p className="location">{profile.state || profile.city}, {profile.country}</p>
            {profile.id && profile.id.startsWith('seed_') && (
              <div className="online-badge">
                <div className={`online-dot ${userOnlineStatus[profile.id] ? 'online' : 'offline'}`}></div>
                <span>{userOnlineStatus[profile.id] ? 'Online' : 'Offline'}</span>
              </div>
            )}
            {profile.gallery && profile.gallery.length > 1 && (
              <div className="photo-count-badge">
                <span>{profile.gallery.length} photos</span>
              </div>
            )}
          </div>
          {isTopCard && (
            <>
              {showLikeBadge && (
                <div className="swipe-badge swipe-badge-like" style={{ opacity: likeBadgeOpacity }}>
                  LIKE
                </div>
              )}
              {showPassBadge && (
                <div className="swipe-badge swipe-badge-pass" style={{ opacity: passBadgeOpacity }}>
                  NOPE
                </div>
              )}
              {showSuperBadge && (
                <div className="swipe-badge swipe-badge-super" style={{ opacity: superBadgeOpacity }}>
                  SUPER LIKE
                </div>
              )}
            </>
          )}
          {isTopCard && (
            <div className="card-actions-overlay">
              <button onClick={() => triggerSwipeAction('pass', handlePass)} className="pass-btn">
                <span>✕</span>
              </button>
              <button onClick={() => triggerSwipeAction('superlike', handleSuperLike)} className="superlike-btn">
                <span>★</span>
              </button>
              <button onClick={() => triggerSwipeAction('like', handleLike)} className="like-btn">
                <span>♥</span>
              </button>
            </div>
          )}
        </div>

        <div className="card-info">
          <p className="bio">
            {profile.bio
              ? `${profile.bio.slice(0, 100)}${profile.bio.length > 100 ? '...' : ''}`
              : 'No bio provided'}
          </p>
          {profile.interests && profile.interests.length > 0 && (
            <p className="profile-summary">
              Interests: {profile.interests.slice(0, 3).join(', ')}{profile.interests.length > 3 ? ` +${profile.interests.length - 3}` : ''}
            </p>
          )}
          {isTopCard && (
            <button type="button" className="view-profile-btn card-info-btn" onClick={() => openProfileDetails(profile)}>
              View full profile
            </button>
          )}
        </div>
      </div>
    );
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
        {stackUsers.map((profile, index) => renderProfileCard(profile, index === 0, index))}
      </div>

      {profileModalOpen && selectedProfile && (
        <div className="profile-modal-backdrop" onClick={closeProfileDetails}>
          <div className="profile-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={closeProfileDetails}>×</button>
            <div className="profile-modal-image">
              <img src={resolveImageUrl((selectedProfile.gallery && selectedProfile.gallery.length > 0 && selectedProfile.gallery[0].url) || selectedProfile.photo)} alt={selectedProfile.name} onError={(e) => { e.currentTarget.src = '/default-avatar.svg'; }} />
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
