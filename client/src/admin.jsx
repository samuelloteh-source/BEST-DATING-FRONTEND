import { useEffect, useState } from 'react';
import axios, { resolveImageUrl } from './api';

export default function Admin() {
  const [users, setUsers] = useState([]);
  
  useEffect(() => {
    axios.get('/api/admin/users')
      .then(res => setUsers(res.data || []))
      .catch(err => console.log(err));
  }, []);

  return (
    <div style={{padding: 30}}>
      <h1>Admin Panel</h1>
      <table border="1" cellPadding="10" style={{marginTop: 20}}>
        <thead>
          <tr>
            <th>Photo</th>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td style={{padding: 0}}>
                <img
                  src={resolveImageUrl(u.avatar || u.photo) || 'https://via.placeholder.com/60?text=No+Photo'}
                  alt={u.name || 'Avatar'}
                  style={{width: 60, height: 60, objectFit: 'cover', borderRadius: '50%'}}
                />
              </td>
              <td>{u.id}</td>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}