const db = require('./db.js');

db.initDb().then(() => {
  db.loadUsersFromDb().then(users => {
    console.log(`\nTotal users: ${users.length}\n`);
    
    let photoUrlCount = 0;
    let photoCount = 0;
    let avatarCount = 0;
    let noImageCount = 0;
    
    users.forEach(user => {
      const hasPhotoUrl = user.photoUrl && user.photoUrl.trim();
      const hasPhoto = user.photo && user.photo.trim();
      const hasAvatar = user.avatar && user.avatar.trim();
      
      if (hasPhotoUrl) photoUrlCount++;
      if (hasPhoto) photoCount++;
      if (hasAvatar) avatarCount++;
      if (!hasPhotoUrl && !hasPhoto && !hasAvatar) noImageCount++;
    });
    
    console.log('Image field summary:');
    console.log(`- Users with photoUrl: ${photoUrlCount}`);
    console.log(`- Users with photo: ${photoCount}`);
    console.log(`- Users with avatar: ${avatarCount}`);
    console.log(`- Users with NO images: ${noImageCount}\n`);
    
    console.log('Sample users:\n');
    users.slice(0, 3).forEach(user => {
      console.log(`Email: ${user.email}`);
      console.log(`  photoUrl: ${user.photoUrl ? user.photoUrl.substring(0, 70) + '...' : '(empty)'}`);
      console.log(`  photo: ${user.photo ? user.photo.substring(0, 70) + '...' : '(empty)'}`);
      console.log(`  avatar: ${user.avatar ? user.avatar.substring(0, 70) + '...' : '(empty)'}`);
      console.log('');
    });
    
    process.exit(0);
  }).catch(e => {
    console.error('Error loading users:', e.message);
    process.exit(1);
  });
}).catch(e => {
  console.error('Error initializing DB:', e.message);
  process.exit(1);
});
