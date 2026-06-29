const axios = require('axios').default;
const https = require('https');

const baseUrl = 'http://127.0.0.1:3000';
const testEmail = 'ava.brooks@example.com';
const testPassword = 'password123';

(async () => {
  try {
    const loginRes = await axios.post(`${baseUrl}/login`, { email: testEmail, password: testPassword }, {
      validateStatus: () => true,
    });
    console.log('LOGIN STATUS', loginRes.status);
    console.log('LOGIN DATA', loginRes.data);
    const token = loginRes.data.token || (loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'].join('; ') : null);
    if (!token) {
      console.error('No token returned from login, test cannot continue.');
      process.exit(1);
    }

    const usersRes = await axios.get(`${baseUrl}/users`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      validateStatus: () => true,
    });
    console.log('USERS STATUS', usersRes.status);
    console.log('USERS DATA KEYS', Object.keys(usersRes.data));
    console.log('USERS COUNT', Array.isArray(usersRes.data) ? usersRes.data.length : 'N/A');
    if (Array.isArray(usersRes.data)) {
      console.log('SAMPLE USER', usersRes.data[0]);
    } else {
      console.log('USERS RESPONSE', usersRes.data);
    }
  } catch (err) {
    console.error('ERROR', err.message);
    if (err.response) {
      console.error('RESPONSE DATA', err.response.data);
    }
  }
})();
