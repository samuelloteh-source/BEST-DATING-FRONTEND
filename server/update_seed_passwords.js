const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI missing');
    process.exit(1);
  }

  await mongoose.connect(uri, { tls: true, ssl: true, connectTimeoutMS: 10000, serverSelectionTimeoutMS: 10000 });

  const password = 'Password123!';
  const hash = await bcrypt.hash(password, 10);
  const result = await User.updateMany(
    { email: /@example\.com$/i },
    {
      $set: {
        passwordHash: hash,
        password: hash,
        emailVerified: true,
        isVerified: true,
        updatedAt: Date.now(),
      },
    }
  );

  console.log('updated', result.modifiedCount);
  await mongoose.disconnect();
})();
