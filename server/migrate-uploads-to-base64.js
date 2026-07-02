const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const usersFile = path.join(DATA_DIR, 'users.json');

async function detectImageContentType(buffer) {
  const hex = buffer.subarray(0, 12).toString('hex');
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('89504e47')) return 'image/png';
  if (hex.startsWith('47494638')) return 'image/gif';
  if (hex.startsWith('52494646') && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return 'image/jpeg'; // default
}

async function migrateUploads() {
  try {
    console.log('🔄 Starting migration of old uploads to base64...\n');

    // Read users.json
    const usersData = await fs.readFile(usersFile, 'utf-8');
    const users = JSON.parse(usersData);

    let migratedCount = 0;
    let skippedCount = 0;

    // Process each user
    for (const user of users) {
      let userModified = false;

      // Migrate photo/avatar
      if (user.photo && typeof user.photo === 'string' && user.photo.startsWith('/uploads/')) {
        const fileName = user.photo.replace('/uploads/', '');
        const filePath = path.join(UPLOADS_DIR, fileName);

        try {
          const buffer = await fs.readFile(filePath);
          const mimeType = await detectImageContentType(buffer);
          const base64String = buffer.toString('base64');
          const dataUrl = `data:${mimeType};base64,${base64String}`;
          user.photo = dataUrl;
          user.avatar = dataUrl;
          userModified = true;
          console.log(`✅ Migrated ${user.name} (${user.id}): photo converted to base64`);
        } catch (err) {
          console.warn(`⚠️  Could not read file for ${user.name}: ${fileName} - setting to empty`);
          user.photo = '';
          user.avatar = '';
          userModified = true;
        }
      }

      // Migrate gallery items
      if (user.gallery && Array.isArray(user.gallery)) {
        for (const image of user.gallery) {
          if (image.url && typeof image.url === 'string' && image.url.startsWith('/uploads/')) {
            const fileName = image.url.replace('/uploads/', '');
            const filePath = path.join(UPLOADS_DIR, fileName);

            try {
              const buffer = await fs.readFile(filePath);
              const mimeType = await detectImageContentType(buffer);
              const base64String = buffer.toString('base64');
              const dataUrl = `data:${mimeType};base64,${base64String}`;
              image.url = dataUrl;
              userModified = true;
              console.log(`  └─ Gallery image migrated to base64`);
            } catch (err) {
              console.warn(`  └─ ⚠️  Could not read gallery file: ${fileName} - removing`);
              image.url = '';
            }
          }
        }
      }

      if (userModified) {
        migratedCount++;
      } else {
        skippedCount++;
      }
    }

    // Write updated users.json
    await fs.writeFile(usersFile, JSON.stringify(users, null, 2));

    console.log(`\n✅ Migration complete!`);
    console.log(`   📊 Migrated: ${migratedCount} users`);
    console.log(`   ⏭️  Skipped: ${skippedCount} users (already using external URLs or empty)`);
    console.log(`   💾 Updated: ${usersFile}`);
    console.log(`\n🚀 Ready to deploy!`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateUploads();
