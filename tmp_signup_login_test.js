const base = 'https://best-dating.vercel.app';
const now = Date.now();
const testUser = {
  name: 'Test User',
  dob: '1990-01-01',
  email: `test.user.${now}@example.com`,
  password: 'Password123!',
  country: 'USA',
  state: 'TestState',
  bio: 'Testing signup flow',
  interests: ['testing', 'node'],
  gender: 'Male',
  lookingFor: 'Female'
};

(async function run() {
  try {
    const signupRes = await fetch(`${base}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    const signup = await signupRes.json();
    console.log('SIGNUP status', signupRes.status);
    console.log('SIGNUP body', JSON.stringify(signup, null, 2));
    if (!signup.success || !signup.token) {
      throw new Error(`Signup failed: ${JSON.stringify(signup)}`);
    }

    const loginRes = await fetch(`${base}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });
    const login = await loginRes.json();
    console.log('LOGIN status', loginRes.status);
    console.log('LOGIN body', JSON.stringify(login, null, 2));
    if (!login.success || !login.token) {
      throw new Error(`Login failed: ${JSON.stringify(login)}`);
    }

    const meRes = await fetch(`${base}/me`, {
      headers: { Authorization: `Bearer ${login.token}` }
    });
    const me = await meRes.json();
    console.log('ME status', meRes.status);
    console.log('ME body', JSON.stringify(me, null, 2));
    if (!me.success || !me.user) {
      throw new Error(`Me endpoint failed: ${JSON.stringify(me)}`);
    }

    console.log('Signup/login flow validated successfully.');
  } catch (err) {
    console.error('FLOW ERROR:', err.message);
    process.exit(1);
  }
})();
