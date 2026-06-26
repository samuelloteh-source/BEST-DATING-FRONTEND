(async () => {
  const base = 'http://127.0.0.1:3001';
  const tests = [
    {
      method: 'POST',
      path: '/signup',
      body: {
        name: 'Test User',
        email: `test+api+${Date.now()}@example.com`,
        password: 'Test1234!',
        dob: '1990-01-01',
        country: 'USA',
        state: 'CA',
        bio: 'api test',
        gender: 'Man',
        lookingFor: 'Women'
      }
    },
    {
      method: 'POST',
      path: '/verify/face',
      body: { match: true, score: 0.9, distance: 0.1 }
    }
  ];

  for (const t of tests) {
    try {
      const res = await fetch(base + t.path, {
        method: t.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t.body)
      });
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }
      console.log(`---- ${t.method} ${t.path} -> ${res.status}`);
      console.log(body);
    } catch (err) {
      console.error(`ERROR ${t.method} ${t.path}:`, err.message || err);
    }
  }
})();
