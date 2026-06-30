const base = 'https://spark-backend-steel.vercel.app';
const urls = ['/health', '/seed-users/status', '/api/admin/users'];
(async () => {
  for (const u of urls) {
    try {
      const res = await fetch(base + u, { method: 'GET' });
      const text = await res.text();
      console.log('URL', u, 'status', res.status);
      console.log(text.slice(0, 500));
    } catch (err) {
      console.error('ERROR', u, err.message);
    }
  }
})();
