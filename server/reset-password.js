const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

try {
  const dotenv = require('dotenv');
  const envPaths = [path.join(__dirname, '..', '.env'), path.join(__dirname, '.env')];
  const envFile = envPaths.find(p => fs.existsSync(p));
  if (envFile) dotenv.config({ path: envFile });
} catch (e) {}

const MONGO_URI = process.env.MONGO_URI;

async function resetPassword(email, newPassword) {
  if (!MONGO_URI) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }
  
  await mongoose.connect(MONGO_URI, { tls: true, ssl: true });
  
  try {
    const normalizedEmail = email.trim().toLowerCase();
    
    console.log(`\nResetting password for: ${normalizedEmail}`);
    
    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      console.log(`✗ User not found: ${normalizedEmail}`);
      await mongoose.disconnect();
      process.exit(1);
    }
    
    console.log(`✓ User found: ${user.name}`);
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update user
    user.passwordHash = hashedPassword;
    user.password = hashedPassword;
    await user.save();
    
    console.log(`✓ Password updated successfully`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Get email and password from command line args
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: node reset-password.js <email> <password>');
  console.log('Example: node reset-password.js sam@gmail.com "Hommie123@"');
  process.exit(1);
}

resetPassword(email, password);
