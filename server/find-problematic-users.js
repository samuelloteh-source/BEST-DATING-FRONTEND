const db = require('./db.js');
const fs = require('fs');
const path = require('path');

// Normalize email like backend does
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function findProblematicUsers() {
  await db.initDb();
  
  console.log('\n=== CHECKING FOR PROBLEMATIC ACCOUNTS ===\n');
  
  const users = await db.loadUsersFromDb();
  console.log(`Total users loaded: ${users.length}\n`);
  
  // Check for users that might fail login
  let problematic = [];
  
  users.forEach((user, idx) => {
    const issues = [];
    
    // Check password
    const hasPassword = (user.password || user.passwordHash) ? true : false;
    if (!hasPassword) issues.push('no password');
    
    // Check email verification (if explicitly false, it would block login)
    if (user.emailVerified === false) issues.push('email not verified');
    
    // Check if email is normalized
    const hasEmail = user.email && user.email.trim();
    if (!hasEmail) issues.push('no email');
    
    if (issues.length > 0) {
      problematic.push({
        email: user.email || '(no email)',
        id: user.id,
        issues: issues,
        hasPasswordHash: !!user.passwordHash,
        hasPassword: !!user.password,
        emailVerified: user.emailVerified
      });
    }
  });
  
  if (problematic.length > 0) {
    console.log(`Found ${problematic.length} problematic accounts:\n`);
    problematic.slice(0, 20).forEach((u, idx) => {
      console.log(`${idx + 1}. ${u.email}`);
      console.log(`   Issues: ${u.issues.join(', ')}`);
      console.log(`   passwordHash: ${u.hasPasswordHash}, password: ${u.hasPassword}, verified: ${u.emailVerified}\n`);
    });
    
    if (problematic.length > 20) {
      console.log(`... and ${problematic.length - 20} more problematic accounts`);
    }
  } else {
    console.log('✓ All accounts appear valid for login');
  }
  
  // Check for duplicate emails
  console.log('\n=== CHECKING FOR DUPLICATE EMAILS ===\n');
  const emailMap = new Map();
  users.forEach(u => {
    const normalized = normalizeEmail(u.email);
    if (!emailMap.has(normalized)) {
      emailMap.set(normalized, []);
    }
    emailMap.get(normalized).push(u.id);
  });
  
  let duplicates = 0;
  emailMap.forEach((ids, email) => {
    if (ids.length > 1) {
      console.log(`Email "${email}" has ${ids.length} accounts:`);
      ids.forEach(id => console.log(`  - ${id}`));
      duplicates++;
    }
  });
  
  if (duplicates === 0) {
    console.log('✓ No duplicate emails found');
  }
  
  process.exit(0);
}

findProblematicUsers().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
