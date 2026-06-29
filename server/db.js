const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
// Ensure root .env is loaded when this module is required directly
if (!process.env.MONGO_URI) {
  try {
    const dotenv = require('dotenv');
    const rootEnv = path.join(__dirname, '..', '.env');
    if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
  } catch (e) {}
}
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI;
const DATA_DIR = path.join(__dirname, 'data');
const PENDING_SIGNUPS_FILE = path.join(DATA_DIR, 'pending_signups.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

let dbConnected = false;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

async function initDb() {
  if (dbConnected) return;
  if (!MONGO_URI) {
    throw new Error('MONGO_URI is required for MongoDB persistence.');
  }
  await mongoose.connect(MONGO_URI, {
    tls: true,
    ssl: true,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
  });
  dbConnected = true;
  console.log('Mongo Connected');
}

mongoose.connection.on('error', (err) => {
  console.error('Mongo connection error:', err);
});

function normalizeUserRecord(user) {
  if (!user) return null;
  const normalized = {
    ...user,
    id: user._id ? String(user._id) : String(user.id || ''),
    password: user.password || user.passwordHash || '',
    photo: user.photo || user.photoUrl || '',
    emailVerified: user.emailVerified !== undefined ? user.emailVerified : user.isVerified || false,
  };
  delete normalized._id;
  delete normalized.__v;
  return normalized;
}

async function loadJsonFile(filePath, fallback) {
  try {
    const contents = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(contents);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function saveJsonFile(filePath, data) {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function loadUsersFromDb() {
  await initDb();
  const users = await User.find().lean();
  return users.map(normalizeUserRecord);
}

async function saveUsersToDb(users) {
  await initDb();
  const normalizedUsers = Array.isArray(users) ? users.filter(Boolean) : [];
  const ids = [];

  for (const user of normalizedUsers) {
    const id = String(user.id || user._id || user.email || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const update = {
      name: user.name || '',
      email: normalizeEmail(user.email),
      passwordHash: user.passwordHash || user.password || '',
      photoUrl: user.photoUrl || user.photo || '',
      isVerified: user.isVerified !== undefined ? user.isVerified : Boolean(user.emailVerified),
      authToken: user.authToken,
      authTokenExpires: user.authTokenExpires,
      sessionVersion: typeof user.sessionVersion === 'number' ? user.sessionVersion : Number(user.sessionVersion || 0),
      emailVerificationToken: user.emailVerificationToken,
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

    const doc = await User.findOneAndUpdate(
      { _id: id },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    ids.push(String(doc._id));
  }

  if (ids.length === 0) {
    await User.deleteMany({});
  } else {
    await User.deleteMany({ _id: { $nin: ids } });
  }
}

async function loadPendingSignupsFromDb() {
  return loadJsonFile(PENDING_SIGNUPS_FILE, []);
}

async function savePendingSignupsToDb(signups) {
  return saveJsonFile(PENDING_SIGNUPS_FILE, Array.isArray(signups) ? signups : []);
}

async function loadMessagesFromDb() {
  return loadJsonFile(MESSAGES_FILE, []);
}

async function saveMessagesToDb(messages) {
  return saveJsonFile(MESSAGES_FILE, Array.isArray(messages) ? messages : []);
}

module.exports = {
  DB_MODE: 'mongodb',
  initDb,
  loadUsersFromDb,
  saveUsersToDb,
  loadPendingSignupsFromDb,
  savePendingSignupsToDb,
  loadMessagesFromDb,
  saveMessagesToDb,
};
