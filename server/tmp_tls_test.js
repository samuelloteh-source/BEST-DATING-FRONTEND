const tls = require('tls');
const host = 'ac-pzbvpv5-shard-00-00.nhfxqji.mongodb.net';
const port = 27017;
const configs = [
  { label: 'default', opts: { host, port, servername: host, timeout: 10000 } },
  { label: 'tls12', opts: { host, port, servername: host, minVersion: 'TLSv1.2', maxVersion: 'TLSv1.2', timeout: 10000 } },
  { label: 'tls13', opts: { host, port, servername: host, minVersion: 'TLSv1.3', maxVersion: 'TLSv1.3', timeout: 10000 } },
  { label: 'sec1', opts: { host, port, servername: host, minVersion: 'TLSv1.2', timeout: 10000, ciphers: 'DEFAULT:@SECLEVEL=1', rejectUnauthorized: false } },
  { label: 'sec0', opts: { host, port, servername: host, minVersion: 'TLSv1.2', timeout: 10000, ciphers: 'DEFAULT:@SECLEVEL=0', rejectUnauthorized: false } },
];

async function test({ label, opts }) {
  return new Promise((resolve) => {
    console.log('---', label);
    const s = tls.connect(opts, () => {
      console.log('connected', s.authorized, s.authorizationError, s.getProtocol());
      s.end();
      resolve();
    });
    s.on('error', (err) => {
      console.error('error', err.code, err.message);
      resolve();
    });
    s.on('timeout', () => {
      console.error('timeout');
      s.destroy();
      resolve();
    });
  });
}
(async () => {
  for (const conf of configs) {
    await test(conf);
  }
})();
