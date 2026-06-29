const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URI || 'mongodb://samuelloteh_db_user:HaCkMyAsS%40%40%23%2A124%23@ac-pzbvpv5-shard-00-00.nhfxqji.mongodb.net:27017,ac-pzbvpv5-shard-00-01.nhfxqji.mongodb.net:27017,ac-pzbvpv5-shard-00-02.nhfxqji.mongodb.net:27017/best-dating?tls=true&ssl=true&replicaSet=ac-pzbvpv5-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';

async function testDirect(uri, label) {
  const client = new MongoClient(uri, {
    directConnection: true,
    serverSelectionTimeoutMS: 15000,
    tls: true,
    ssl: true,
  });
  try {
    await client.connect();
    console.log(`${label}: connected`);
  } catch (err) {
    console.error(`${label}:`, err.name, err.message);
    if (err.reason) {
      console.error(`${label} reason:`, err.reason.type);
    }
  } finally {
    try { await client.close(); } catch {};
  }
}

(async () => {
  console.log('Testing full replica set URI');
  await testDirect(uri, 'replica');

  const hosts = [
    'ac-pzbvpv5-shard-00-00.nhfxqji.mongodb.net',
    'ac-pzbvpv5-shard-00-01.nhfxqji.mongodb.net',
    'ac-pzbvpv5-shard-00-02.nhfxqji.mongodb.net',
  ];
  for (let i = 0; i < hosts.length; i++) {
    const single = `mongodb://samuelloteh_db_user:HaCkMyAsS%40%40%23%2A124%23@${hosts[i]}:27017/best-dating?tls=true&ssl=true&authSource=admin`;
    await testDirect(single, `single${i}`);
  }
})();
