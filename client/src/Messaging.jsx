import { useState, useEffect } from 'react';
import axios, { resolveImageUrl } from './api';
import './Messaging.css';

export default function Messaging({ user, match, onBack }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [match]);

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`/messages/conversation/${match.id}`);
      setMessages(response.data.messages || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmedText = inputText.trim();
    if (!trimmedText && !selectedFile) return;

    try {
      const formData = new FormData();
      formData.append('recipientId', match.id);
      if (trimmedText) formData.append('text', trimmedText);
      if (selectedFile) formData.append('photo', selectedFile);

      await axios.post('/messages/send', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setInputText('');
      setSelectedFile(null);
      fetchMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  if (loading) {
    return <div className="messaging-container"><p>Loading conversation...</p></div>;
  }

  return (
    <div className="messaging-container">
      <div className="messaging-header">
        <button onClick={onBack} className="back-btn">← Back</button>
        <div className="header-info">
          <img src={resolveImageUrl(match.photo) || 'https://via.placeholder.com/40'} alt={match.name} />
          <h2>{match.name}</h2>
        </div>
      </div>

      <div className="messages-list">
        {messages.length === 0 ? (
          <div className="no-messages">Say hello!</div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`message ${msg.from === user.id ? 'sent' : 'received'}`}
            >
              <div className="message-bubble">
                {msg.text && <span>{msg.text}</span>}
                {msg.photo && <img src={resolveImageUrl(msg.photo)} alt="Sent attachment" />}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSendMessage} className="message-form">
        <label className="image-upload-label">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          />
          📷
        </label>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          className="message-input"
        />
        <button type="submit" className="send-btn">Send</button>
      </form>
      {selectedFile && <div className="selected-file-preview">Selected: {selectedFile.name}</div>}
    </div>
  );
}
