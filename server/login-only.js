(async ()=>{
  const base='http://localhost:3000';
  const email='smoke_injected_1781676800757@example.com';
  const password='Password123!';
  try{
    const res = await fetch(`${base}/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    console.log('status',res.status);
    const j = await res.json().catch(()=>null);
    console.log('body',j);
  }catch(e){console.error(e)}
})();
