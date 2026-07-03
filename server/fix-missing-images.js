const db = require('./db.js');

const DEFAULT_PROFILES = [
  'https://randomuser.me/api/portraits/women/10.jpg',
  'https://randomuser.me/api/portraits/men/10.jpg',
  'https://randomuser.me/api/portraits/women/11.jpg',
  'https://randomuser.me/api/portraits/men/11.jpg',
  'https://randomuser.me/api/portraits/women/12.jpg',
  'https://randomuser.me/api/portraits/men/12.jpg',
  'https://randomuser.me/api/portraits/women/13.jpg',
];

db.initDb().then(async () => {
  const users = await db.loadUsersFromDb();
  console.log('\n=== Fixing users with missing images ===\n');
  
  let fixedCount = 0;
  
  // Find and fix users without images
  const updatedUsers = users.map((user, index) => {
    const hasPhotoUrl = user.photoUrl && user.photoUrl.trim();
    const hasPhoto = user.photo && user.photo.trim();
    const hasAvatar = user.avatar && user.avatar.trim();
    
    if (!hasPhotoUrl && !hasPhoto && !hasAvatar) {
      const defaultImage = DEFAULT_PROFILES[fixedCount % DEFAULT_PROFILES.length];
      console.log(`✓ Fixed ${user.email}`);
      console.log(`  -> ${defaultImage}\n`);
      fixedCount++;
      
      return {
        ...user,
        photoUrl: defaultImage,
        photo: defaultImage,
        avatar: defaultImage
      };
    }
    return user;
  });
  
  // Save updated users back to database
  await db.saveUsersToDb(updatedUsers);
  
  console.log(`\nTotal users fixed: ${fixedCount}`);
  console.log('Changes saved to database.');
  process.exit(0);
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
