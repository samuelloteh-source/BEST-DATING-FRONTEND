const axios = require('axios').default;

const baseUrl = 'http://127.0.0.1:3000';
const testUser = {
  name: 'Verified Test',
  dob: '1990-01-01',
  bio: 'Verified user to test login and user visibility.',
  email: 'verified.test@example.com',
  password: 'Test1234!',
  country: 'USA',
  gender: 'Female',
  state: 'California',
  interests: ['testing', 'mongo']
};

(async () => {
  try {
    console.log('Signing up test user...');
    const signupRes = await axios.post(`${baseUrl}/signup`, testUser, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    });
    console.log('SIGNUP STATUS', signupRes.status);
    console.log('SIGNUP DATA', signupRes.data);

    console.log('Logging in test user...');
    const loginRes = await axios.post(`${baseUrl}/login`, { email: testUser.email, password: testUser.password }, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    });
    console.log('LOGIN STATUS', loginRes.status);
    console.log('LOGIN DATA', loginRes.data);
    if (!loginRes.data || !loginRes.data.token) {
      console.error('Login failed, cannot fetch /users.');
      process.exit(1);
    }
    const token = loginRes.data.token;

    console.log('Fetching /users ...');
    const usersRes = await axios.get(`${baseUrl}/users`, {
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true,
    });
    console.log('USERS STATUS', usersRes.status);
    if (Array.isArray(usersRes.data)) {
      console.log('USERS COUNT', usersRes.data.length);
      console.log('FIRST USER', usersRes.data[0]);
    } else {
      console.log('USERS DATA', usersRes.data);
    }
  } catch (err) {
    console.error('ERROR', err.message);
    if (err.response) {
      console.error('RESPONSE', err.response.status, err.response.data);
    }
    process.exit(1);
  }
})();
