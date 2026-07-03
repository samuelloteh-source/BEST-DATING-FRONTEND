const db = require('./db.js');
const bcrypt = require('bcrypt');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function testLogin() {
  await db.initDb();
  
  console.log('\n=== TESTING LOGIN PROCESS ===\n');
  
  const testCases = [
    { email: 'sam@gmail.com', password: 'needs-to-be-checked' },
    { email: 'okay@gmail.com', password: 'needs-to-be-checked' }
  ];
  
  const users = await db.loadUsersFromDb();
  
  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.email}`);
    
    const normalizedEmail = normalizeEmail(testCase.email);
    console.log(`  Normalized email: ${normalizedEmail}`);
    
    // Step 1: Find user by email
    const user = users.find(u => normalizeEmail(u.email) === normalizedEmail);
    
    if (!user) {
      console.log(`  ✗ STEP 1 FAILED: User not found in database`);
      console.log('');
      continue;
    }
    
    console.log(`  ✓ STEP 1: User found`);
    console.log(`    User ID: ${user.id}`);
    console.log(`    User email (from DB): ${user.email}`);
    console.log(`    Has passwordHash: ${!!user.passwordHash}`);
    console.log(`    Has password field: ${!!user.password}`);
    
    // Step 2: Check password verification capability
    const passwordCandidates = [user.passwordHash || user.password || ''];
    
    console.log(`  Password candidates to test: ${passwordCandidates.length}`);
    passwordCandidates.forEach((cand, idx) => {
      const isHash = cand.startsWith('$2');
      console.log(`    Candidate ${idx}: ${isHash ? 'bcrypt hash' : 'plaintext or other'}`);
      console.log(`      First 20 chars: ${cand.substring(0, 20)}...`);
    });
    
    // Step 3: Check what would happen in login
    console.log(`  ✓ STEP 2: Ready for password verification`);
    console.log(`    (Note: Cannot test actual password without knowing password)\n`);
  }
  
  // Additional check: verify all users have passwords
  console.log('=== CHECKING ALL USER PASSWORDS ===\n');
  
  let withPassword = 0;
  let withPasswordHash = 0;
  let withBoth = 0;
  let withNeither = 0;
  
  users.forEach(u => {
    const hasPw = !!u.password;
    const hasHash = !!u.passwordHash;
    
    if (hasPw && hasHash) withBoth++;
    else if (hasPw) withPassword++;
    else if (hasHash) withPasswordHash++;
    else withNeither++;
  });
  
  console.log(`Users with password field only: ${withPassword}`);
  console.log(`Users with passwordHash field only: ${withPasswordHash}`);
  console.log(`Users with both: ${withBoth}`);
  console.log(`Users with NEITHER: ${withNeither}`);
  
  if (withNeither > 0) {
    console.log('\n✗ WARNING: Some users have no password!');
    users.filter(u => !u.password && !u.passwordHash).slice(0, 5).forEach(u => {
      console.log(`  - ${u.email}`);
    });
  }
  
  process.exit(0);
}

testLogin().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
