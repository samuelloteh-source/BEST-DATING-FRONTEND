const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const User = require('../models/User');

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, {
    tls: true,
    ssl: true,
    connectTimeoutMS: 20000,
    serverSelectionTimeoutMS: 30000,
  });

  const files = [
    path.join(__dirname, '..', 'data', 'users.json'),
    path.join(__dirname, '..', 'users.json'),
  ];

  const seenEmails = new Set();
  const records = [];

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data)) continue;

    for (const user of data) {
      if (!user || !user.email) continue;
      const email = String(user.email).trim().toLowerCase();
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);
      records.push(user);
    }
  }

  let imported = 0;
  let skipped = 0;

  for (const user of records) {
    const email = String(user.email || '').trim().toLowerCase();
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      skipped += 1;
      continue;
    }

    const doc = {
      _id: String(user.id || user._id || email),
      name: user.name || '',
      email,
      passwordHash: user.passwordHash || user.password || '',
      photoUrl: user.photoUrl || user.photo || user.avatar || '',
      isVerified: user.isVerified ?? user.emailVerified ?? false,
      emailVerified: user.isVerified ?? user.emailVerified ?? false,
      authToken: user.authToken,
      authTokenExpires: user.authTokenExpires,
      sessionVersion: typeof user.sessionVersion === 'number' ? user.sessionVersion : Number(user.sessionVersion || 0),
      emailVerificationToken: user.emailVerificationToken || user.verificationToken,
      verificationToken: user.verificationToken || user.emailVerificationToken,
      passwordResetToken: user.passwordResetToken,
      passwordResetExpires: user.passwordResetExpires,
      suspended: !!user.suspended,
      dob: user.dob || '',
      gender: user.gender || '',
      country: user.country || '',
      state: user.state || '',
      bio: user.bio || '',
      interests: Array.isArray(user.interests) ? user.interests : [],
      lookingFor: user.lookingFor || 'Any',
      likes: Array.isArray(user.likes) ? user.likes : [],
      messages: Array.isArray(user.messages) ? user.messages : [],
      gallery: Array.isArray(user.gallery) ? user.gallery : [],
      notifications: Array.isArray(user.notifications) ? user.notifications : [],
      matches: Array.isArray(user.matches) ? user.matches : [],
      passed: Array.isArray(user.passed) ? user.passed : [],
      updatedAt: user.updatedAt || Date.now(),
      createdAt: user.createdAt || Date.now(),
    };

    await User.create(doc);
    imported += 1;
  }

  console.log(`Imported new users: ${imported}`);
  console.log(`Skipped existing users: ${skipped}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
