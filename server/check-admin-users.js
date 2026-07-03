const db = require('./db.js');
const fs = require('fs');
const path = require('path');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function checkAdminUsers() {
  await db.initDb();
  
  console.log('\n=== USERS THAT APPEAR IN ADMIN PANEL ===\n');
  
  // This mimics what backend.js does for admin panel
  const users = await db.loadUsersFromDb();
  
  console.log(`Total users visible in admin: ${users.length}\n`);
  
  // Check for users that might show as "No account found" when trying to login
  // This happens when the login tries to find the user but it doesn't exist or email doesn't match
  
  const emailCounts = new Map();
  const duplicates = [];
  
  users.forEach(user => {
    const normalized = normalizeEmail(user.email);
    
    if (!emailCounts.has(normalized)) {
      emailCounts.set(normalized, []);
    }
    emailCounts.get(normalized).push({
      id: user.id,
      email: user.email,
      hasPassword: !!(user.password || user.passwordHash)
    });
  });
  
  // Find duplicates
  emailCounts.forEach((entries, email) => {
    if (entries.length > 1) {
      duplicates.push({
        email: email,
        accounts: entries
      });
    }
  });
  
  if (duplicates.length > 0) {
    console.log(`⚠ Found ${duplicates.length} emails with multiple accounts:\n`);
    duplicates.forEach((dup, idx) => {
      console.log(`${idx + 1}. "${dup.email}" has ${dup.accounts.length} accounts:`);
      dup.accounts.forEach(acc => {
        console.log(`   - ${acc.id} (password: ${acc.hasPassword ? 'YES' : 'NO'})`);
      });
      console.log('');
    });
    
    console.log('PROBLEM: When users try to login, MongoDB/file finds MULTIPLE users.');
    console.log('The .find() method returns the first match, but since there are');
    console.log('multiple accounts with same email, it may return the wrong one.\n');
  } else {
    console.log('✓ No duplicate emails found in admin view');
  }
  
  process.exit(0);
}

checkAdminUsers().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
