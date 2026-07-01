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
console.log('DB using User _id type:', User.schema.paths._id.instance, 'opts:', User.schema.paths._id.options);

const MONGO_URI = process.env.MONGO_URI;
const REPO_DATA_DIR = path.join(__dirname, 'data');
const DATA_DIR = process.env.VERCEL
  ? path.join(require('os').tmpdir(), 'best-dating-data')
  : REPO_DATA_DIR;
const PENDING_SIGNUPS_FILE = path.join(DATA_DIR, 'pending_signups.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const REPO_USERS_FILE = path.join(REPO_DATA_DIR, 'users.json');

let dbConnected = false;
const useMongo = Boolean(MONGO_URI);

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

async function initDb() {
  if (dbConnected) return;
  if (!useMongo) {
    // Ensure writable temp storage exists for file-based storage in serverless environments
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    if (process.env.VERCEL) {
      try {
        const targetUsersFile = path.join(DATA_DIR, 'users.json');
        if (!fs.existsSync(targetUsersFile) && fs.existsSync(REPO_USERS_FILE)) {
          await fs.promises.copyFile(REPO_USERS_FILE, targetUsersFile);
          console.log('Copied seeded users file to writable temp storage');
        }
      } catch (copyErr) {
        console.warn('Unable to copy seeded data to temp storage:', copyErr.message || copyErr);
      }
    }
    dbConnected = true;
    console.log('DB using file-based storage at', DATA_DIR);
    return;
  }

  // Connect to MongoDB when MONGO_URI is provided
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
    emailVerified: user.emailVerified !== undefined ? user.emailVerified : (user.isVerified !== undefined ? user.isVerified : undefined),
  };
  delete normalized._id;
  delete normalized.__v;
  return normalized;
}

function getUserIdentity(user) {
  if (!user) return '';
  const id = String(user.id || user._id || '').trim();
  if (id) return id;
  return normalizeEmail(user.email || '');
}

async function ensureRepoSeedUsers(users) {
  const currentUsers = Array.isArray(users) ? users.filter(Boolean).map(normalizeUserRecord) : [];
  const repoUsers = await loadJsonFile(REPO_USERS_FILE, []);
  const repoSeedUsers = Array.isArray(repoUsers) ? repoUsers.filter(Boolean).map(normalizeUserRecord) : [];

  if (!repoSeedUsers.length) {
    return currentUsers;
  }

  const mergedUsers = [];
  const seen = new Set();

  for (const user of currentUsers) {
    const identity = getUserIdentity(user);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    mergedUsers.push(user);
  }

  for (const user of repoSeedUsers) {
    const identity = getUserIdentity(user);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    mergedUsers.push(user);
  }

  return mergedUsers;
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
  if (!useMongo) {
    const usersFile = path.join(DATA_DIR, 'users.json');
    try {
      const contents = await fs.promises.readFile(usersFile, 'utf8');
      const users = JSON.parse(contents);
      const normalizedUsers = Array.isArray(users) ? users.map(normalizeUserRecord) : [];
      return await ensureRepoSeedUsers(normalizedUsers);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  const users = await User.find().lean();
  const normalized = users.map(normalizeUserRecord);
  return await ensureRepoSeedUsers(normalized);
}

async function saveUsersToDb(users) {
  await initDb();
  const normalizedUsers = Array.isArray(users) ? users.filter(Boolean).map(normalizeUserRecord) : [];
  if (!useMongo) {
    const usersFile = path.join(DATA_DIR, 'users.json');
    const mergedUsers = await ensureRepoSeedUsers(normalizedUsers);
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    await fs.promises.writeFile(usersFile, JSON.stringify(mergedUsers, null, 2), 'utf8');
    return;
  }

  const ids = [];
  for (const user of normalizedUsers) {
    const id = String(user.id || user._id || user.email || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const update = {
      name: user.name || '',
      email: normalizeEmail(user.email),
      passwordHash: user.passwordHash || user.password || '',
      photoUrl: user.photoUrl || user.photo || '',
      ...(user.isVerified !== undefined || user.emailVerified !== undefined ? {
        isVerified: user.isVerified !== undefined ? user.isVerified : Boolean(user.emailVerified)
      } : {}),
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
