const http = require('http');
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';
process.env.ADMIN_PASSWORD = 'test123';
const handler = require('./server/backend');
const server = http.createServer(handler);
server.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  const options = { hostname: '127.0.0.1', port, path: '/admin?show_pw=1', method: 'GET' };
  http.get(options, (res) => {
    console.log('STATUS', res.statusCode, res.statusMessage);
    console.log('HEADERS', res.headers);
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      console.log('BODY_START', body.slice(0, 500).replace(/\n/g, ' '));
      server.close();
    });
  }).on('error', (err) => {
    console.error('REQUEST ERROR', err.stack || err);
    server.close();
  });
});
