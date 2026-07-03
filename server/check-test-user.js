const db = require('./db.js');

db.initDb().then(() => {
  db.loadUsersFromDb().then(users => {
    const testUser = users.find(u => u.email === 'testuser@example.com' || u.name === 'Test User');
    
    if (testUser) {
      console.log('\n=== Test User Profile ===');
      console.log('Email:', testUser.email);
      console.log('Name:', testUser.name);
      console.log('ID:', testUser._id || testUser.id);
      console.log('\nImage fields:');
      console.log('photoUrl:', testUser.photoUrl ? testUser.photoUrl.substring(0, 100) + '...' : '(empty)');
      console.log('photo:', testUser.photo ? testUser.photo.substring(0, 100) + '...' : '(empty)');
      console.log('avatar:', testUser.avatar ? testUser.avatar.substring(0, 100) + '...' : '(empty)');
    } else {
      console.log('Test User not found. Users with similar names:');
      users.filter(u => u.name && u.name.toLowerCase().includes('test')).forEach(u => {
        console.log(`- ${u.email}: "${u.name}"`);
      });
    }
    
    process.exit(0);
  }).catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
