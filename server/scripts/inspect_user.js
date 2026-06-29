const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { tls: true, ssl: true, connectTimeoutMS: 10000, serverSelectionTimeoutMS: 10000 });
  const user = await User.findOne({ email: 'ava.brooks@example.com' }).lean();
  console.log('user:', user);
  await mongoose.disconnect();
})();
