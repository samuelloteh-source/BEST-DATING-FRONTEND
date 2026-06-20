import { useState, useEffect } from 'react';
import axios from 'axios';
import './Matches.css';

export default function Matches({ user, onSelectMatch, onLogout }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatches();
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
        <h1>Matches</h1>
        <button onClick={onLogout} className="logout-btn">Logout</button>
      </div>

      {matches.length === 0 ? (
        <div className="no-matches">
          <p>No matches yet. Keep swiping!</p>
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
                  src={match.photo || 'https://via.placeholder.com/150?text=No+Photo'} 
                  alt={match.name}
                />
                <div className="match-overlay">
                  <h3>{match.name}</h3>
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
