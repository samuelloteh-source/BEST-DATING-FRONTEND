const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
// Ensure .env is loaded when this module is required directly
if (!process.env.MONGO_URI) {
  try {
    const dotenv = require('dotenv');
    const envPaths = [
      path.join(__dirname, '..', '.env'),
      path.join(__dirname, '.env')
    ];
    const envFile = envPaths.find((p) => fs.existsSync(p));
    if (envFile) dotenv.config({ path: envFile });
  } catch (e) {
    console.warn('Failed to load .env for Mongo config:', e.message || e);
  }
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
const LOCAL_USERS_FILE = path.join(DATA_DIR, 'users.json');
const LOCAL_SYNC_INTERVAL_MS = 60 * 1000; // sync at most once per minute

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
    emailVerified: user.isVerified !== undefined
      ? user.isVerified
      : user.emailVerified !== undefined
        ? user.emailVerified
        : undefined,
    verificationToken: user.verificationToken || user.emailVerificationToken || undefined,
    emailVerificationToken: user.emailVerificationToken || user.verificationToken || undefined,
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
  console.log('DEBUG ensureRepoSeedUsers readJsonFile', typeof readJsonFile);
  const repoUsers = await readJsonFile(REPO_USERS_FILE, []);
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

function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

async function readJsonFile(filePath, fallback) {
  try {
    const contents = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(contents);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJsonFile(filePath, data) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function loadJsonFile(filePath, fallback) {
  return readJsonFile(filePath, fallback);
}

async function saveJsonFile(filePath, data) {
  return writeJsonFile(filePath, data);
}

async function loadLocalUsersFromFile() {
  await initDb();
  const users = await readJsonFile(LOCAL_USERS_FILE, []);
  return Array.isArray(users) ? users.map(normalizeUserRecord) : [];
}

let lastLocalSync = 0;

async function syncLocalUsersToMongo() {
  const localUsers = await loadLocalUsersFromFile();
  if (!Array.isArray(localUsers) || !localUsers.length) return;

  for (const localUser of localUsers) {
    const email = normalizeEmail(localUser.email);
    if (!email) continue;

    const existing = await User.findOne({ email }).lean();
    const id = existing ? String(existing._id) : String(localUser.id || localUser._id || email);
    const passwordHash = localUser.passwordHash || (isBcryptHash(localUser.password) ? localUser.password : '');
    const update = {
      name: localUser.name || '',
      email,
      photoUrl: localUser.photoUrl || localUser.photo || '',
      isVerified: localUser.isVerified !== undefined
        ? localUser.isVerified
        : localUser.emailVerified !== undefined
          ? Boolean(localUser.emailVerified)
          : undefined,
      emailVerified: localUser.emailVerified !== undefined
        ? localUser.emailVerified
        : localUser.isVerified !== undefined
          ? localUser.isVerified
          : undefined,
      emailVerificationToken: localUser.emailVerificationToken || localUser.verificationToken,
      verificationToken: localUser.verificationToken || localUser.emailVerificationToken,
      passwordResetToken: localUser.passwordResetToken,
      passwordResetExpires: localUser.passwordResetExpires,
      suspended: !!localUser.suspended,
      dob: localUser.dob || '',
      gender: localUser.gender || '',
      country: localUser.country || '',
      state: localUser.state || '',
      bio: localUser.bio || '',
      interests: Array.isArray(localUser.interests) ? localUser.interests : [],
      lookingFor: localUser.lookingFor || 'Any',
      likes: Array.isArray(localUser.likes) ? localUser.likes : [],
      messages: Array.isArray(localUser.messages) ? localUser.messages : [],
      gallery: Array.isArray(localUser.gallery) ? localUser.gallery : [],
      notifications: Array.isArray(localUser.notifications) ? localUser.notifications : [],
      matches: Array.isArray(localUser.matches) ? localUser.matches : [],
      passed: Array.isArray(localUser.passed) ? localUser.passed : [],
      updatedAt: localUser.updatedAt || Date.now(),
      createdAt: localUser.createdAt || Date.now(),
    };

    if (passwordHash) {
      update.passwordHash = passwordHash;
    } else if (localUser.password && !isBcryptHash(localUser.password)) {
      update.passwordHash = await bcrypt.hash(localUser.password, 10);
    } else if (existing && existing.passwordHash) {
      update.passwordHash = existing.passwordHash;
    } else {
      update.passwordHash = '';
    }

    await User.findOneAndUpdate(
      { _id: id },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

async function syncLocalUsersToMongoIfNeeded() {
  if (!useMongo) return;
  const now = Date.now();
  if (now - lastLocalSync < LOCAL_SYNC_INTERVAL_MS) return;
  lastLocalSync = now;
  try {
    await syncLocalUsersToMongo();
  } catch (err) {
    console.warn('Local-to-Mongo sync failed:', err && err.message ? err.message : err);
  }
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

  await syncLocalUsersToMongoIfNeeded();
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
    const email = normalizeEmail(user.email);
    let existingUser = null;
    if (email) {
      existingUser = await User.findOne({ email }).lean();
    }

    const id = existingUser
      ? String(existingUser._id)
      : String(user.id || user._id || user.email || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    let passwordHash = '';
    if (user.passwordHash) {
      passwordHash = user.passwordHash;
    } else if (user.password && isBcryptHash(user.password)) {
      passwordHash = user.password;
    } else if (user.password) {
      passwordHash = await bcrypt.hash(user.password, 10);
    } else if (existingUser && existingUser.passwordHash) {
      passwordHash = existingUser.passwordHash;
    }

    const verifiedValue = user.isVerified !== undefined
      ? user.isVerified
      : user.emailVerified !== undefined
        ? Boolean(user.emailVerified)
        : undefined;

    const update = {
      name: user.name || '',
      email,
      passwordHash,
      photoUrl: user.photoUrl || user.photo || '',
      ...(verifiedValue !== undefined ? {
        isVerified: verifiedValue,
        emailVerified: verifiedValue
      } : {}),
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
  return readJsonFile(PENDING_SIGNUPS_FILE, []);
}

async function savePendingSignupsToDb(signups) {
  return writeJsonFile(PENDING_SIGNUPS_FILE, Array.isArray(signups) ? signups : []);
}

async function loadMessagesFromDb() {
  return readJsonFile(MESSAGES_FILE, []);
}

async function saveMessagesToDb(messages) {
  return writeJsonFile(MESSAGES_FILE, Array.isArray(messages) ? messages : []);
}

module.exports = {
  DB_MODE: 'mongodb',
  initDb,
  loadUsersFromDb,
  saveUsersToDb,
  loadLocalUsersFromFile,
  loadPendingSignupsFromDb,
  savePendingSignupsToDb,
  loadMessagesFromDb,
  saveMessagesToDb,
};
