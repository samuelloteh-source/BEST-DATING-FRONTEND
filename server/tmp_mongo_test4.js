const { MongoClient } = require('mongodb');
const user = 'samuelloteh_db_user';
const password = 'HaCkMyAsS%40%40%23%2A124%23';
const dbName = 'best-dating';
const host = 'ac-pzbvpv5-shard-00-00.nhfxqji.mongodb.net';
const uri = `mongodb://${user}:${password}@${host}:27017/${dbName}?authSource=admin&tls=true&replicaSet=ac-pzbvpv5-shard-0&retryWrites=true&w=majority`;
console.log('URI:', uri);
(async () => {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    console.log('connected');
    await client.close();
  } catch (e) {
    console.error('error', e.name, e.message);
    if (e.reason) console.error('reason', e.reason);
  }
})();
