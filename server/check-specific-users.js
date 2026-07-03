const db = require('./db.js');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function checkSpecificUsers() {
  await db.initDb();
  
  console.log('\n=== CHECKING FOR SPECIFIC USERS ===\n');
  
  const users = await db.loadUsersFromDb();
  console.log(`Total users in database: ${users.length}\n`);
  
  const targetEmails = ['sam@gmail.com', 'okay@gmail.com'];
  
  targetEmails.forEach(targetEmail => {
    const normalized = normalizeEmail(targetEmail);
    const found = users.find(u => normalizeEmail(u.email) === normalized);
    
    console.log(`Searching for: ${targetEmail}`);
    console.log(`Normalized: ${normalized}`);
    
    if (found) {
      console.log(`✓ FOUND`);
      console.log(`  Email: ${found.email}`);
      console.log(`  ID: ${found.id}`);
      console.log(`  Name: ${found.name}`);
      console.log(`  Password: ${found.password ? 'YES' : 'NO'}`);
      console.log(`  PasswordHash: ${found.passwordHash ? 'YES' : 'NO'}`);
      console.log(`  Verified: ${found.emailVerified}`);
    } else {
      console.log(`✗ NOT FOUND`);
    }
    console.log('');
  });
  
  // Also check if there are any similar emails
  console.log('=== SEARCHING FOR SIMILAR EMAILS ===\n');
  const similar = users.filter(u => {
    const email = normalizeEmail(u.email);
    return email.includes('sam') || email.includes('okay');
  });
  
  if (similar.length > 0) {
    console.log(`Found ${similar.length} similar email(s):\n`);
    similar.forEach(u => {
      console.log(`  - ${u.email}`);
    });
  } else {
    console.log('No similar emails found');
  }
  
  process.exit(0);
}

checkSpecificUsers().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
