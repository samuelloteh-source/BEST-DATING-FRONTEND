const db = require('./db.js');

db.initDb().then(() => {
  db.loadUsersFromDb().then(users => {
    console.log('\n=== Users with NO images ===\n');
    
    const noImages = users.filter(u => {
      const hasPhotoUrl = u.photoUrl && u.photoUrl.trim();
      const hasPhoto = u.photo && u.photo.trim();
      const hasAvatar = u.avatar && u.avatar.trim();
      return !hasPhotoUrl && !hasPhoto && !hasAvatar;
    });
    
    console.log(`Total users with NO images: ${noImages.length}\n`);
    
    noImages.forEach(u => {
      console.log(`${u.email} (${u.name || 'N/A'})`);
    });
    
    process.exit(0);
  }).catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
