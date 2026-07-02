const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  const targetPassword = 'Home';
  const emails = ['sam@gmail.com', 'samuelloteh@gmail.com'];

  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, {
    tls: true,
    ssl: true,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
  });

  const hash = await bcrypt.hash(targetPassword, 10);

  for (const email of emails) {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await User.updateOne(
      { email: normalizedEmail },
      {
        $set: {
          passwordHash: hash,
          password: hash,
          emailVerified: true,
          isVerified: true,
          updatedAt: new Date(),
        },
      },
      { upsert: false }
    );
    console.log(`${email}: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
  }

  const repoUsersPath = path.join(__dirname, '..', 'users.json');
  if (fs.existsSync(repoUsersPath)) {
    const users = JSON.parse(fs.readFileSync(repoUsersPath, 'utf8'));
    let changed = 0;

    for (const user of users) {
      if (typeof user.email === 'string' && emails.includes(user.email.toLowerCase())) {
        user.passwordHash = hash;
        user.password = hash;
        user.emailVerified = true;
        user.isVerified = true;
        user.updatedAt = Date.now();
        changed += 1;
      }
    }

    if (changed) {
      fs.writeFileSync(repoUsersPath, JSON.stringify(users, null, 2));
      console.log(`Updated repo users.json entries: ${changed}`);
    }
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
