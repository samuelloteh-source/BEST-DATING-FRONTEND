import { useState, useEffect, useRef } from 'react';
import axios, { apiBaseUrl, resolveImageUrl } from './api';
import io from 'socket.io-client';
import './Matches.css';

export default function Matches({ user, title = 'Matches', emptyText = 'No matches yet. Keep swiping!', onSelectMatch, onLogout }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userOnlineStatus, setUserOnlineStatus] = useState({});
  const socketRef = useRef(null);

  useEffect(() => {
    fetchMatches();

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

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/matches');
      setMatches(response.data.matches || []);
    } catch (err) {
      console.error('Failed to fetch matches:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="matches-container"><p>Loading matches...</p></div>;
  }

  return (
    <div className="matches-container">
      <div className="matches-header">
        <h1>{title}</h1>
      </div>

      {matches.length === 0 ? (
        <div className="no-matches">
          <p>{emptyText}</p>
        </div>
      ) : (
        <div className="matches-grid">
          {matches.map((match) => (
            <div 
              key={match.id} 
              className="match-card"
              onClick={() => onSelectMatch(match)}
            >
              <div className="match-image">
                <img 
                  src={resolveImageUrl(match.photo) || 'https://via.placeholder.com/150?text=No+Photo'} 
                  alt={match.name}
                />
                <div className="match-overlay">
                  <h3>{match.name}</h3>
                  {match.id && match.id.startsWith('seed_') && (
                    <div className="online-badge">
                      <div className={`online-dot ${userOnlineStatus[match.id] ? 'online' : 'offline'}`}></div>
                      <span>{userOnlineStatus[match.id] ? 'Online' : 'Offline'}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="match-info">
                <p className="match-location">{match.state}, {match.country}</p>
                <p className="match-bio">{match.bio?.substring(0, 50)}...</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
