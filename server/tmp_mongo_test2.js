const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const uri = process.env.MONGO_URI;
console.log('Using URI:', uri ? uri.replace(/(mongodb:\/\/[^:]+:)[^@]+(@.*)/, '$1***$2') : 'MONGO_URI not set');

async function testUri(uri, opts = {}, label = 'default') {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, ...opts });
  try {
    await client.connect();
    console.log(`${label}: connected`);
    await client.close();
  } catch (err) {
    console.error(`${label}:`, err.name, err.message);
    if (err.reason) {
      console.error(`${label} reason:`, err.reason);
    }
  }
}

(async () => {
  if (!uri) {
    console.error('MONGO_URI is missing');
    process.exit(1);
  }

  await testUri(uri, {}, 'replicaSet');

  const hosts = [
    'ac-pzbvpv5-shard-00-00.nhfxqji.mongodb.net',
    'ac-pzbvpv5-shard-00-01.nhfxqji.mongodb.net',
    'ac-pzbvpv5-shard-00-02.nhfxqji.mongodb.net',
  ];
  for (let i = 0; i < hosts.length; i++) {
    const singleUri = `mongodb://samuelloteh_db_user:HaCkMyAsS%40%40%23%2A124%23@${hosts[i]}:27017/best-dating?authSource=admin&tls=true&ssl=true`;
    await testUri(singleUri, { directConnection: true }, `direct-${i}`);
  }
})();
