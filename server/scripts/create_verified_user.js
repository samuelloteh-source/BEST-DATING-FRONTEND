const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { tls: true, ssl: true, connectTimeoutMS: 10000, serverSelectionTimeoutMS: 10000 });
  const password = 'Test1234!';
  const hash = await bcrypt.hash(password, 10);
  const user = await User.findOneAndUpdate(
    { email: 'verified.test@example.com' },
    {
      _id: 'verified-test-user',
      name: 'Verified Test',
      email: 'verified.test@example.com',
      passwordHash: hash,
      emailVerified: true,
      isVerified: true,
      createdAt: new Date(),
      interests: ['testing', 'mongo'],
      bio: 'Verified test user for app login.'
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log('created user', user.email);
  await mongoose.disconnect();
})();
