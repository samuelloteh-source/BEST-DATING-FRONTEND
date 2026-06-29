const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../db');
const users = require('../users.json');

(async () => {
  try {
    console.log('Initializing DB...');
    await db.initDb();
    console.log(`Uploading ${Array.isArray(users) ? users.length : 0} users to MongoDB...`);
    await db.saveUsersToDb(users);
    console.log('Import complete.');
    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
