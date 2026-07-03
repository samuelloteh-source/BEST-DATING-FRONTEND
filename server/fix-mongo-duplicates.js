const mongoose = require('mongoose');
const User = require('./models/User');
const path = require('path');
const fs = require('fs');

// Load env
try {
  const dotenv = require('dotenv');
  const envPaths = [path.join(__dirname, '..', '.env'), path.join(__dirname, '.env')];
  const envFile = envPaths.find(p => fs.existsSync(p));
  if (envFile) dotenv.config({ path: envFile });
} catch (e) {}

const MONGO_URI = process.env.MONGO_URI;

async function fixDuplicatesInMongo() {
  if (!MONGO_URI) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }
  
  try {
    await mongoose.connect(MONGO_URI, { tls: true, ssl: true });
    console.log('Connected to MongoDB\n');
    
    console.log('=== FIXING DUPLICATE EMAILS IN MONGODB ===\n');
    
    // Get all users
    const users = await User.find().lean();
    console.log(`Total users: ${users.length}\n`);
    
    // Group by normalized email
    const emailMap = new Map();
    const toDelete = [];
    
    const sortedUsers = [...users].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return aTime - bTime;
    });
    
    sortedUsers.forEach(user => {
      const normalized = (user.email || '').trim().toLowerCase();
      
      if (!emailMap.has(normalized)) {
        emailMap.set(normalized, user._id.toString());
      } else {
        toDelete.push({
          email: user.email,
          id: user._id.toString(),
          kept: emailMap.get(normalized)
        });
      }
    });
    
    if (toDelete.length === 0) {
      console.log('✓ No duplicates found');
      await mongoose.disconnect();
      process.exit(0);
    }
    
    console.log(`Found ${toDelete.length} duplicate accounts:\n`);
    
    // Group output
    const byEmail = new Map();
    toDelete.forEach(dup => {
      if (!byEmail.has(dup.email)) byEmail.set(dup.email, []);
      byEmail.get(dup.email).push(dup.id);
    });
    
    byEmail.forEach((ids, email) => {
      console.log(`"${email}"`);
      console.log(`  Keeping: ${emailMap.get(email.toLowerCase())}`);
      ids.forEach(id => console.log(`  Deleting: ${id}`));
      console.log('');
    });
    
    // Delete duplicates
    console.log('Deleting duplicates...\n');
    for (const dup of toDelete) {
      await User.findByIdAndDelete(dup.id);
      console.log(`✓ Deleted ${dup.id} (${dup.email})`);
    }
    
    console.log(`\n✓ Removed ${toDelete.length} duplicate accounts`);
    const remaining = await User.countDocuments();
    console.log(`Remaining users: ${remaining}`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

fixDuplicatesInMongo();
