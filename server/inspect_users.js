const db = require('./db');

(async () => {
  try {
    await db.initDb();
    const users = await db.loadUsersFromDb();
    console.log('count', users.length);
    console.log(JSON.stringify(users.slice(0, 5), null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
