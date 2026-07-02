import React from 'react';

export default function Admin() {
  const openServerAdmin = () => {
    const url = 'http://localhost:3000/admin?show_pw=1';
    try { window.open(url, '_blank', 'noopener,noreferrer'); }
    catch (e) { window.location.href = url; }
  };

  return (
    <div style={{padding: 40, fontFamily: 'Arial'}}>
      <h1>Admin Panel Disabled (SPA)</h1>
      <p>The admin interface has been moved to the server-rendered page.</p>
      <p>
        Please use the server admin at{' '}
        <a href="http://localhost:3000/admin?show_pw=1" target="_blank" rel="noopener noreferrer">http://localhost:3000/admin</a>
      </p>
      <p>
        Or open it directly:
        <button onClick={openServerAdmin} style={{marginLeft: 12, padding: '8px 12px', cursor: 'pointer'}}>Open Server Admin</button>
      </p>
      <p>Note: plaintext passwords are only revealed on the server admin when the request origin is <strong>http://localhost:5173</strong>.</p>
    </div>
  );
}