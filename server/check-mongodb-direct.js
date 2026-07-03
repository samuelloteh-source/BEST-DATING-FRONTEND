const mongoose = require('mongoose');
const User = require('./models/User');
const path = require('path');
const fs = require('fs');

try {
  const dotenv = require('dotenv');
  const envPaths = [path.join(__dirname, '..', '.env'), path.join(__dirname, '.env')];
  const envFile = envPaths.find(p => fs.existsSync(p));
  if (envFile) dotenv.config({ path: envFile });
} catch (e) {}

const MONGO_URI = process.env.MONGO_URI;

async function checkMongoDB() {
  console.log('\n=== CHECKING MONGODB DIRECTLY ===\n');
  
  if (!MONGO_URI) {
    console.log('✗ MONGO_URI not set - app would use file-based storage');
    process.exit(0);
  }
  
  try {
    await mongoose.connect(MONGO_URI, { 
      tls: true, 
      ssl: true,
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✓ MongoDB connection successful\n');
    
    // Check for the test accounts
    const testEmails = ['sam@gmail.com', 'okay@gmail.com'];
    
    for (const email of testEmails) {
      console.log(`Searching MongoDB for: ${email}`);
      const user = await User.findOne({ email: email.toLowerCase() }).lean();
      
      if (user) {
        console.log(`  ✓ FOUND`);
        console.log(`    ID: ${user._id}`);
        console.log(`    Name: ${user.name}`);
        console.log(`    Verified: ${user.emailVerified}`);
        console.log(`    Has passwordHash: ${!!user.passwordHash}`);
      } else {
        console.log(`  ✗ NOT FOUND in MongoDB`);
      }
      console.log('');
    }
    
    // Count total users
    const count = await User.countDocuments();
    console.log(`Total users in MongoDB: ${count}`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('✗ MongoDB connection failed:', err.message);
    console.log('\nThis means the app would fall back to file-based storage.');
    console.log('Check if MONGO_URI is valid and MongoDB is accessible.');
    process.exit(1);
  }
}

checkMongoDB();
