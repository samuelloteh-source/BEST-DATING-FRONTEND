const db = require('./db.js');

db.initDb().then(async () => {
  const users = await db.loadUsersFromDb();
  console.log('\n=== Users with NO images ===\n');
  
  let missingCount = 0;
  users.forEach(user => {
    const hasPhotoUrl = user.photoUrl && user.photoUrl.trim();
    const hasPhoto = user.photo && user.photo.trim();
    const hasAvatar = user.avatar && user.avatar.trim();
    
    if (!hasPhotoUrl && !hasPhoto && !hasAvatar) {
      missingCount++;
      console.log(`${missingCount}. Email: ${user.email}`);
      console.log(`   _id: ${user._id}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log('');
    }
  });
  
  console.log(`\nTotal users missing images: ${missingCount}`);
  process.exit(0);
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
