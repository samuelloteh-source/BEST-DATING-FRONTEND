(async ()=>{
  try{
    const base = 'http://localhost:3000';
    const password = 'Password123!';
    const email = `smoke_${Date.now()}@example.com`;
    console.log('Signup email:', email);

    const signupRes = await fetch(`${base}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, confirmPassword: password, name: 'Smoke Tester', dob: '1990-01-01' })
    });
    console.log('Signup status:', signupRes.status);
    let signupJson = null;
    try { signupJson = await signupRes.json(); } catch(e) {}
    console.log('Signup body:', signupJson);

    // If signup succeeded but requires verification, mark the user verified in users.json for smoke-testing
    if (signupJson && signupJson.success && signupJson.user && signupJson.user.emailVerified === false) {
      try {
        const fs = require('fs');
        const usersPath = require('path').join(__dirname, 'users.json');
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const u = users.find(x => x.email === signupJson.user.email);
        if (u) { u.emailVerified = true; fs.writeFileSync(usersPath, JSON.stringify(users, null, 2)); console.log('Auto-verified signup user for smoke test'); }
      } catch (e) { console.warn('Auto-verify failed', e); }
    }

    const loginRes = await fetch(`${base}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    console.log('Login status:', loginRes.status);
    let loginJson = null;
    try { loginJson = await loginRes.json(); } catch(e) {}
    console.log('Login body:', loginJson);

    const userId = loginJson && (loginJson.user && loginJson.user.id || loginJson.id || (loginJson.userId));
    const token = loginJson && (loginJson.token || loginJson.accessToken);

    if (!userId) {
      console.log('No userId returned from login; skipping message send.');
      return;
    }

    // find a target user
    const usersRes = await fetch(`${base}/users`);
    let users = [];
    try { users = await usersRes.json(); } catch(e){}
    let target = (Array.isArray(users) ? users.find(u => u.id !== userId) : null);
    if (!target) {
      console.log('No target user found; skipping message send.');
      return;
    }
    console.log('Sending message from', userId, 'to', target.id);

    const msgRes = await fetch(`${base}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: userId, to: target.id, text: 'Smoke test hello' })
    });
    console.log('Message send status:', msgRes.status);
    let msgJson = null;
    try { msgJson = await msgRes.json(); } catch(e){}
    console.log('Message response:', msgJson);

  }catch(e){
    console.error('Smoke test failed', e);
    process.exitCode = 2;
  }
})();
