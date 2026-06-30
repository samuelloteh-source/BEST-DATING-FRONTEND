const base = 'https://best-dating.vercel.app';
const email = 'test.user.1782775632194@example.com';
const password = 'Password123!';

(async () => {
  try {
    const res = await fetch(`${base}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const body = await res.json();
    console.log('LOGIN status', res.status);
    console.log('LOGIN body', JSON.stringify(body, null, 2));
    if (res.status !== 200 || !body.success || !body.token) {
      throw new Error('Login verification failed');
    }
    console.log('Login verification succeeded.');
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();
