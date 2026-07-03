const db = require('./db.js');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function fixDuplicateEmails() {
  await db.initDb();
  
  console.log('\n=== FIXING DUPLICATE EMAIL ACCOUNTS ===\n');
  
  const users = await db.loadUsersFromDb();
  console.log(`Total users before dedup: ${users.length}\n`);
  
  // Create a map to track which emails we've seen
  const emailMap = new Map();
  const usersToKeep = [];
  const usersDuplicate = [];
  
  // Sort by ID to ensure consistent ordering (keep the first one chronologically)
  const sortedUsers = [...users].sort((a, b) => {
    const aTime = parseInt(String(a.id || a._id || '').split('-').pop() || '0');
    const bTime = parseInt(String(b.id || b._id || '').split('-').pop() || '0');
    return aTime - bTime;
  });
  
  sortedUsers.forEach(user => {
    const normalized = normalizeEmail(user.email);
    
    if (!emailMap.has(normalized)) {
      // First occurrence - keep it
      emailMap.set(normalized, user.id);
      usersToKeep.push(user);
    } else {
      // Duplicate - mark for removal
      usersDuplicate.push({
        email: user.email,
        id: user.id,
        keptId: emailMap.get(normalized)
      });
    }
  });
  
  console.log(`Found ${usersDuplicate.length} duplicate accounts:\n`);
  
  const emailCounts = new Map();
  usersDuplicate.forEach(dup => {
    if (!emailCounts.has(dup.email)) {
      emailCounts.set(dup.email, []);
    }
    emailCounts.get(dup.email).push(dup.id);
  });
  
  emailCounts.forEach((ids, email) => {
    console.log(`"${email}" has duplicates:`);
    console.log(`  Kept: ${emailMap.get(normalizeEmail(email))}`);
    ids.forEach(id => console.log(`  Removed: ${id}`));
    console.log('');
  });
  
  // Save the deduplicated list
  await db.saveUsersToDb(usersToKeep);
  
  console.log(`Total users after dedup: ${usersToKeep.length}`);
  console.log(`✓ Removed ${usersDuplicate.length} duplicate accounts and saved changes`);
  
  process.exit(0);
}

fixDuplicateEmails().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
