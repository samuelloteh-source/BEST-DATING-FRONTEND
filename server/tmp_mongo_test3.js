const { MongoClient } = require('mongodb');
const hosts = [
  'ac-pzbvpv5-shard-00-00.nhfxqji.mongodb.net',
  'ac-pzbvpv5-shard-00-01.nhfxqji.mongodb.net',
  'ac-pzbvpv5-shard-00-02.nhfxqji.mongodb.net',
];
const password = 'HaCkMyAsS%40%40%23%2A124%23';
const user = 'samuelloteh_db_user';
const dbName = 'best-dating';

async function testUri(uri, label) {
  const client = new MongoClient(uri, {
    directConnection: true,
    serverSelectionTimeoutMS: 15000,
    tls: true,
    tlsAllowInvalidCertificates: true,
  });
  try {
    await client.connect();
    console.log(`${label}: connected`);
    await client.close();
  } catch (e) {
    console.error(`${label}:`, e.name, e.message);
    if (e.reason) console.error(`${label} reason:`, e.reason.type);
  }
}

(async () => {
  for (let i = 0; i < hosts.length; i++) {
    const uri = `mongodb://${user}:${password}@${hosts[i]}:27017/${dbName}?authSource=admin&tls=true&tlsAllowInvalidCertificates=true`;
    await testUri(uri, `direct-${i}`);
  }
})();
