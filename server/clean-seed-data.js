const fs = require('fs');
const path = require('path');

// Find the repo seed users file
const repoUsersPath = path.join(__dirname, '..', 'server', 'data', 'users.json');
const localRepoUsersPath = path.join(__dirname, 'data', 'users.json');

const targetPath = fs.existsSync(repoUsersPath) ? repoUsersPath : localRepoUsersPath;

console.log(`\n=== CLEANING UP SEEDED USERS FILE ===\n`);
console.log(`Target file: ${targetPath}`);

try {
  const users = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  console.log(`Original count: ${users.length} users\n`);
  
  // Get current email list
  console.log('Checking for duplicate timestamps in seed data...\n');
  
  const timestamps = new Map();
  const duplicates = [];
  
  users.forEach(user => {
    const time = String(user.id || '').split('-').pop();
    
    if (!timestamps.has(time)) {
      timestamps.set(time, []);
    }
    
    timestamps.get(time).push({
      id: user.id,
      email: user.email,
      name: user.name
    });
  });
  
  // Check if we have old timestamps (duplicates)
  timestamps.forEach((entries, time) => {
    if (entries.length > 1) {
      console.log(`Timestamp ${time} has ${entries.length} users (likely old duplicates)`);
      entries.forEach(e => console.log(`  - ${e.email}`));
      console.log('');
    }
  });
  
  // Keep only the most recent versions (highest timestamps)
  const uniqueUsers = new Map();
  const emailTimestamps = new Map();
  
  users.forEach(user => {
    const email = (user.email || '').toLowerCase().trim();
    const time = parseInt(String(user.id || '').split('-').pop() || '0');
    
    if (!emailTimestamps.has(email) || time > emailTimestamps.get(email)) {
      emailTimestamps.set(email, time);
      uniqueUsers.set(email, user);
    }
  });
  
  const cleaned = Array.from(uniqueUsers.values());
  
  console.log(`\nCleaned count: ${cleaned.length} unique users`);
  console.log(`Removed: ${users.length - cleaned.length} old duplicate versions\n`);
  
  // Write back
  fs.writeFileSync(targetPath, JSON.stringify(cleaned, null, 2));
  console.log(`✓ Updated seed file`);
  
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
