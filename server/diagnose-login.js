const db = require('./db.js');
const fs = require('fs');
const path = require('path');

async function diagnoseLoginIssue() {
  await db.initDb();
  
  console.log('\n=== DIAGNOSING LOGIN ISSUE ===\n');
  
  // Check MongoDB users
  console.log('1. CHECKING MONGODB:');
  try {
    const users = await db.loadUsersFromDb();
    console.log(`   Total users in DB: ${users.length}`);
    if (users.length > 0) {
      console.log('   First 3 users:');
      users.slice(0, 3).forEach(u => {
        console.log(`     - ${u.email} (id: ${u.id}, verified: ${u.emailVerified})`);
      });
    }
  } catch (err) {
    console.log(`   Error: ${err.message}`);
  }
  
  // Check local users file
  console.log('\n2. CHECKING LOCAL USERS FILE:');
  const localUsersPath = path.join(__dirname, 'data', 'users.json');
  try {
    const contents = await fs.promises.readFile(localUsersPath, 'utf8');
    const localUsers = JSON.parse(contents);
    console.log(`   Total users in file: ${localUsers.length}`);
    if (localUsers.length > 0) {
      console.log('   First 3 users:');
      localUsers.slice(0, 3).forEach(u => {
        console.log(`     - ${u.email} (id: ${u.id})`);
      });
    }
  } catch (err) {
    console.log(`   File not found or error: ${err.message}`);
  }
  
  // Check if there's a discrepancy
  console.log('\n3. CHECKING FOR MISMATCHES:');
  try {
    const dbUsers = await db.loadUsersFromDb();
    const localUsers = JSON.parse(await fs.promises.readFile(localUsersPath, 'utf8'));
    
    const dbEmails = new Set(dbUsers.map(u => u.email?.toLowerCase()));
    const localEmails = new Set(localUsers.map(u => u.email?.toLowerCase()));
    
    const inLocalNotInDb = localUsers.filter(u => !dbEmails.has(u.email?.toLowerCase()));
    const inDbNotInLocal = dbUsers.filter(u => !localEmails.has(u.email?.toLowerCase()));
    
    if (inLocalNotInDb.length > 0) {
      console.log(`   Accounts in LOCAL file but NOT in DB: ${inLocalNotInDb.length}`);
      inLocalNotInDb.forEach(u => {
        console.log(`     - ${u.email}`);
      });
    }
    
    if (inDbNotInLocal.length > 0) {
      console.log(`   Accounts in DB but NOT in local file: ${inDbNotInLocal.length}`);
      inDbNotInLocal.slice(0, 5).forEach(u => {
        console.log(`     - ${u.email}`);
      });
    }
    
    if (inLocalNotInDb.length === 0 && inDbNotInLocal.length === 0) {
      console.log('   ✓ No mismatches found - files are in sync');
    }
  } catch (err) {
    console.log(`   Error comparing: ${err.message}`);
  }
  
  process.exit(0);
}

diagnoseLoginIssue().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
