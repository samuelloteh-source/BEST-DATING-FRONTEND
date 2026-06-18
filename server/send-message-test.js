(async ()=>{
  const base='http://localhost:3000';
  const email='smoke_injected_1781676800757@example.com';
  const password='Password123!';
  try{
    const login = await fetch(`${base}/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    const lj = await login.json();
    if (!lj || !lj.success) return console.log('login failed', lj);
    const userId = lj.user.id;
    console.log('logged in as', userId);
    const usersRes = await fetch(`${base}/users?userId=${userId}`);
    const users = await usersRes.json();
    const target = users.find(u => u.id !== userId);
    if (!target) return console.log('no target');
    console.log('target', target.id);
    const msgRes = await fetch(`${base}/messages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:userId,to:target.id,text:'Hello from smoke test'})});
    console.log('msg status', msgRes.status);
    const mj = await msgRes.json().catch(()=>null);
    console.log('msg resp', mj);
  }catch(e){console.error(e)}
})();
