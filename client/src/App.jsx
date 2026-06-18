import { useState } from 'react'
import axios from 'axios'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/login`, {
        email, password
      })
      const message = res.data.message || `Login success, token: ${res.data.token}`
      setMsg(message)
    } catch (err) {
      setMsg('Error: ' + (err.response?.data?.message || err.message))
    }
  }

  return (
    <div style={{padding: '50px', textAlign: 'center'}}>
      <h1>Best Dating Login</h1>
      <form onSubmit={handleLogin}>
        <input 
          type="email" 
          placeholder="Email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{display: 'block', margin: '10px auto', padding: '10px'}}
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{display: 'block', margin: '10px auto', padding: '10px'}}
        />
        <button type="submit" style={{padding: '10px 20px'}}>Login</button>
      </form>
      <p>{msg}</p>
    </div>
  )
}

export default App