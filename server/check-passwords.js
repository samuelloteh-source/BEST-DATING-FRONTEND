const db = require('./db.js');

async function checkPasswords() {
  await db.initDb();
  
  console.log('\n=== CHECKING PLAINTEXT PASSWORDS ===\n');
  
  const users = await db.loadUsersFromDb();
  
  const testEmails = ['sam@gmail.com', 'okay@gmail.com'];
  
  for (const email of testEmails) {
    const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    
    if (user) {
      console.log(`User: ${email}`);
      console.log(`  Password field: ${user.password || '(not set)'}`);
      console.log(`  PasswordHash: ${user.passwordHash ? user.passwordHash.substring(0, 30) + '...' : '(not set)'}`);
      console.log('');
    }
  }
  
  process.exit(0);
}

checkPasswords().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
