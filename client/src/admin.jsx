import { useEffect, useState } from 'react';
import axios from 'axios';

export default function Admin() {
  const [users, setUsers] = useState([]);
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get('http://localhost:3001/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setUsers(res.data)).catch(err => console.log(err));
  }, []);

  return (
    <div style={{padding: 30}}>
      <h1>Admin Panel</h1>
      <table border="1" cellPadding="10" style={{marginTop: 20}}>
        <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}