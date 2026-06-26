const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const socketIo = require('socket.io');

// Temporarily disable canvas/faceapi/tfjs due to native module compilation issues
// Will re-enable once modules are properly built for Node 18
let canvas, faceapi, tf;
let canvasAvailable = false;

try {
  canvas = require('canvas');
  faceapi = require('@vladmandic/face-api');
  tf = require('@tensorflow/tfjs-node');
  const { Canvas, Image, ImageData } = canvas;
  faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
  canvasAvailable = true;
} catch (err) {
  console.warn('⚠️  Canvas/face-api modules not available - face verification disabled:', err.message);
}

const scheduler = require('./seeded-user-scheduler');
const db = require('./db');

const app = express();
const cors = require('cors'); 
app.use(cors());
app.use(express.json()); // 
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || 'sparkdating_jwt_secret';
const INACTIVITY_TIMEOUT_MS = Number(process.env.INACTIVITY_TIMEOUT_MS) || 20 * 60 * 1000; // 20 minutes
// Use the canonical data files in the server folder to avoid multiple user stores
const DATA_DIR = path.join(__dirname); // keep for compatibility
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const base = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      cb(null, ext ? `${base}${ext}` : base);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

function getRandomId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizePhotoUrl(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^(https?:)?\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  if (trimmed.startsWith('uploads/')) return `/${trimmed}`;
  return `/uploads/${trimmed}`;
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function cleanUserForClient(user) {
  if (!user) return null;
  const {
    passwordHash,
    verificationToken,
    ...safe
  } = user;

  const cleaned = {
    ...safe,
    email: normalizeEmail(safe.email),
    photo: normalizePhotoUrl(safe.photo || ''),
    avatar: normalizePhotoUrl(safe.avatar || safe.photo || ''),
    interests: Array.isArray(safe.interests) ? safe.interests : [],
    gallery: Array.isArray(safe.gallery) ? safe.gallery : [],
    notifications: Array.isArray(safe.notifications) ? safe.notifications : [],
    likes: Array.isArray(safe.likes) ? safe.likes : [],
    passed: Array.isArray(safe.passed) ? safe.passed : [],
    matches: Array.isArray(safe.matches) ? safe.matches : [],
  };

  // Add online status for seeded users
  if (safe.id && safe.id.startsWith('seed_')) {
    cleaned.isOnline = scheduler.isSeededUserOnline(safe.id);
  }

  return cleaned;
}

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

async function readJson(filePath, fallback) {
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    return JSON.parse(contents);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function loadUsers() {
  await db.initDb();
  return await db.loadUsersFromDb();
}

async function saveUsers(users) {
  await db.initDb();
  await db.saveUsersToDb(users);
}

async function loadMessages() {
  await db.initDb();
  return await db.loadMessagesFromDb();
}

async function saveMessages(messages) {
  await db.initDb();
  await db.saveMessagesToDb(messages);
}

async function persistSeedAutoLike(seedUserId, targetUserId) {
  const users = await loadUsers();
  const seedUser = users.find(u => u.id === seedUserId);
  const targetUser = users.find(u => u.id === targetUserId);
  if (!seedUser || !targetUser) return;

  seedUser.likes = Array.isArray(seedUser.likes) ? seedUser.likes : [];
  if (!seedUser.likes.includes(targetUserId)) {
    seedUser.likes.push(targetUserId);
  }

  const mutualLike = Array.isArray(targetUser.likes) && targetUser.likes.includes(seedUserId);
  if (mutualLike) {
    seedUser.matches = Array.isArray(seedUser.matches) ? seedUser.matches : [];
    targetUser.matches = Array.isArray(targetUser.matches) ? targetUser.matches : [];

    if (!seedUser.matches.includes(targetUserId)) seedUser.matches.push(targetUserId);
    if (!targetUser.matches.includes(seedUserId)) targetUser.matches.push(seedUserId);

    const timestamp = Date.now();
    seedUser.notifications = Array.isArray(seedUser.notifications) ? seedUser.notifications : [];
    targetUser.notifications = Array.isArray(targetUser.notifications) ? targetUser.notifications : [];
    seedUser.notifications.push({ id: `notif-${timestamp}-${Math.random().toString(36).slice(2, 8)}`, type: 'match', text: `You matched with ${targetUser.name}!`, timestamp, read: false });
    targetUser.notifications.push({ id: `notif-${timestamp}-${Math.random().toString(36).slice(2, 8)}`, type: 'match', text: `You matched with ${seedUser.name}!`, timestamp, read: false });
  }

  await saveUsers(users);
}

async function persistSeedAutoMessage(seedUserId, targetUserId, text) {
  const users = await loadUsers();
  const seedUser = users.find(u => u.id === seedUserId);
  const targetUser = users.find(u => u.id === targetUserId);
  if (!seedUser || !targetUser) return;

  const messages = await loadMessages();
  messages.push({
    id: getRandomId(),
    from: seedUserId,
    to: targetUserId,
    text: sanitizeString(text || ''),
    photo: '',
    timestamp: Date.now(),
  });
  await saveMessages(messages);
}

function getAuthToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || req.headers['x-auth-token'];
  if (typeof authHeader === 'string') {
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  }
  const cookieHeader = req.headers.cookie || '';
  const tokenPair = cookieHeader.split(';').map(v => v.trim()).find(v => v.startsWith('authToken='));
  return tokenPair ? tokenPair.split('=')[1] : null;
}

async function authMiddleware(req, res, next) {
  const token = getAuthToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Missing authentication token' });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  const users = await loadUsers();
  const user = users.find(u => String(u.id) === String(payload.id));
  if (!user) {
    return res.status(401).json({ success: false, message: 'User not found' });
  }

  // Inactivity timeout: require re-login after period of inactivity
  try {
    const last = Number(user.lastActivity || 0);
    if (last && (Date.now() - last) > INACTIVITY_TIMEOUT_MS) {
      return res.status(401).json({ success: false, message: 'Session inactive. Please sign in again.' });
    }
    // Update last activity and persist
    user.lastActivity = Date.now();
    await saveUsers(users);
  } catch (e) {
    console.warn('Failed to update lastActivity:', e && e.message ? e.message : e);
  }

  req.user = user;
  req.userId = String(user.id);
  next();
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

function detectImageContentType(buffer) {
  if (!buffer || buffer.length < 4) return 'application/octet-stream';
  const sig = buffer.subarray(0, 12);
  const hex = sig.toString('hex');
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('89504e47')) return 'image/png';
  if (hex.startsWith('47494638')) return 'image/gif';
  if (hex.startsWith('52494646') && sig.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return 'application/octet-stream';
}

app.use('/uploads', async (req, res, next) => {
  const fileName = (req.path || '').replace(/^\/+/, '').split('/')[0];
  if (!fileName || fileName.includes('..')) return next();
  const filePath = path.join(UPLOADS_DIR, fileName);
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return next();
    const buffer = await fs.readFile(filePath);
    const contentType = detectImageContentType(buffer);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=31536000');
    return res.send(buffer);
  } catch (err) {
    return next();
  }
});
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/me', authMiddleware, async (req, res) => {
  return res.json({ success: true, user: cleanUserForClient(req.user) });
});
// Admin: get all users
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await loadUsers();
    const rows = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: normalizeEmail(user.email),
      role: user.role || 'user',
      created_at: user.created_at || user.createdAt || null,
      photo: normalizePhotoUrl(user.photo || ''),
      avatar: normalizePhotoUrl(user.avatar || user.photo || '')
    }));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unable to load admin users' });
  }
});
app.post('/signup', upload.array('photos', 10), async (req, res) => {
  try {
    const { name, dob, email, password, country, state, bio, interests, gender, lookingFor } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!name || !normalizedEmail || !password || !dob || !gender || !lookingFor) {
      return res.status(400).json({ success: false, message: 'Name, email, password, date of birth, gender, and looking-for preferences are required.' });
    }

    const users = await loadUsers();
    if (users.find(user => normalizeEmail(user.email) === normalizedEmail)) {
      return res.json({ success: false, message: 'Email already exists' });
    }

    const interestArray = typeof interests === 'string'
      ? interests.split(',').map(i => sanitizeString(i)).filter(Boolean)
      : Array.isArray(interests)
        ? interests.map(i => sanitizeString(i)).filter(Boolean)
        : [];

    const files = Array.isArray(req.files) ? req.files : [];
    const photoPaths = files.map((file) => `/uploads/${file.filename}`);
    const photoPath = photoPaths.length > 0 ? photoPaths[0] : '';
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = {
      id: getRandomId(),
      name: sanitizeString(name),
      dob: sanitizeString(dob),
      email: normalizedEmail,
      passwordHash,
      country: sanitizeString(country) || '',
      state: sanitizeString(state) || '',
      bio: sanitizeString(bio) || '',
      gender: sanitizeString(gender) || '',
      lookingFor: sanitizeString(lookingFor) || '',
      interests: interestArray.slice(0, 5),
      photo: photoPath,
      avatar: photoPath,
      gallery: photoPaths.map((url) => ({ id: getRandomId(), url })),
      likes: [],
      passed: [],
      matches: [],
      notifications: [],
      emailVerified: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    users.push(newUser);
    await saveUsers(users);

    return res.json({ success: true, message: 'Signup complete. You may now log in.' });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ success: false, message: 'Unable to create account.' });
  }
});

// Face verification endpoint (client-side detection, server validates)
app.post('/verify/face', async (req, res) => {
  try {
    const { match, score, distance } = req.body;
    if (typeof match !== 'boolean' || typeof score !== 'number') {
      return res.status(400).json({ success: false, message: 'Invalid verification data' });
    }
    return res.json({
      success: true,
      match,
      score,
      distance,
      profileFaceDetected: true,
      selfieFaceDetected: true,
      threshold: 0.55,
    });
  } catch (err) {
    console.error('Face verification error:', err);
    return res.status(500).json({ success: false, message: 'Verification error' })
  }
})

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const users = await loadUsers();
    const user = users.find(u => normalizeEmail(u.email) === normalizedEmail);
    if (!user) {
      return res.json({ success: false, message: 'No account found' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash || '');
    if (!isValid) {
      return res.json({ success: false, message: 'Wrong password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    try {
      user.lastActivity = Date.now();
      await saveUsers(users);
    } catch (e) {
      console.warn('Could not persist lastActivity on login:', e && e.message ? e.message : e);
    }
    return res.json({ success: true, user: cleanUserForClient(user), token });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/logout', authMiddleware, async (req, res) => {
  return res.json({ success: true });
});

app.post('/resend-verification', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) {
    return res.status(400).json({ success: false, message: 'Missing email' });
  }
  return res.json({ success: true, message: 'If that email exists, a verification link has been sent.' });
});

app.get('/verify-email', async (req, res) => {
  const token = String(req.query.token || '');
  const users = await loadUsers();
  const user = users.find(u => u.verificationToken === token);
  if (user) {
    user.emailVerified = true;
    delete user.verificationToken;
    await saveUsers(users);
    return res.send('<h2>Email verified</h2><p>Your email has been verified. You may now log in.</p>');
  }
  return res.send('<h2>Verification</h2><p>Link invalid or already verified.</p>');
});

app.get('/discover', authMiddleware, async (req, res) => {
  const users = await loadUsers();
  const currentUser = users.find(u => u.id === req.userId);
  if (!currentUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const excluded = new Set([currentUser.id, ...(currentUser.passed || []), ...(currentUser.likes || []), ...(currentUser.matches || [])]);
  const candidates = users
    .filter(u => {
      if (excluded.has(u.id) || u.emailVerified === false) return false;
      // Filter out offline seeded users
      if (u.id && u.id.startsWith('seed_') && !scheduler.isSeededUserOnline(u.id)) return false;
      return true;
    })
    .map(cleanUserForClient);

  return res.json({ success: true, users: candidates });
});

app.post('/discover/like', authMiddleware, async (req, res) => {
  const { targetId } = req.body;
  if (!targetId) {
    return res.status(400).json({ success: false, message: 'Missing targetId' });
  }

  const users = await loadUsers();
  const currentUser = users.find(u => u.id === req.userId);
  const targetUser = users.find(u => u.id === String(targetId));
  if (!currentUser || !targetUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  currentUser.likes = Array.isArray(currentUser.likes) ? currentUser.likes : [];
  if (!currentUser.likes.includes(targetUser.id)) {
    currentUser.likes.push(targetUser.id);
  }

  // Queue interaction if target is a seeded user and offline
  if (targetUser.id && targetUser.id.startsWith('seed_')) {
    const wasQueued = scheduler.queueInteractionIfOffline(targetUser.id, {
      type: 'like',
      fromUserId: currentUser.id,
      fromName: currentUser.name
    });
    if (wasQueued) {
      await saveUsers(users);
      return res.json({ success: true, isMatch: false, message: 'Like sent! They will see it when they come online.' });
    }
  }

  const mutualLike = Array.isArray(targetUser.likes) && targetUser.likes.includes(currentUser.id);
  let isMatch = false;

  if (mutualLike) {
    currentUser.matches = Array.isArray(currentUser.matches) ? currentUser.matches : [];
    targetUser.matches = Array.isArray(targetUser.matches) ? targetUser.matches : [];
    if (!currentUser.matches.includes(targetUser.id)) currentUser.matches.push(targetUser.id);
    if (!targetUser.matches.includes(currentUser.id)) targetUser.matches.push(currentUser.id);
    isMatch = true;

    const timestamp = Date.now();
    currentUser.notifications = Array.isArray(currentUser.notifications) ? currentUser.notifications : [];
    targetUser.notifications = Array.isArray(targetUser.notifications) ? targetUser.notifications : [];
    currentUser.notifications.push({ id: `notif-${timestamp}-${Math.random().toString(36).slice(2, 8)}`, type: 'match', text: `You matched with ${targetUser.name}!`, timestamp, read: false });
    targetUser.notifications.push({ id: `notif-${timestamp}-${Math.random().toString(36).slice(2, 8)}`, type: 'match', text: `You matched with ${currentUser.name}!`, timestamp, read: false });
  }

  await saveUsers(users);
  return res.json({ success: true, isMatch, message: isMatch ? `You matched with ${targetUser.name}!` : 'Liked successfully' });
});

app.post('/discover/pass', authMiddleware, async (req, res) => {
  const { targetId } = req.body;
  if (!targetId) {
    return res.status(400).json({ success: false, message: 'Missing targetId' });
  }

  const users = await loadUsers();
  const currentUser = users.find(u => u.id === req.userId);
  if (!currentUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  currentUser.passed = Array.isArray(currentUser.passed) ? currentUser.passed : [];
  if (!currentUser.passed.includes(targetId)) {
    currentUser.passed.push(targetId);
  }

  await saveUsers(users);
  return res.json({ success: true, message: 'Pass recorded' });
});

app.post('/discover/superlike', authMiddleware, async (req, res) => {
  const { targetId } = req.body;
  if (!targetId) {
    return res.status(400).json({ success: false, message: 'Missing targetId' });
  }

  const users = await loadUsers();
  const currentUser = users.find(u => u.id === req.userId);
  const targetUser = users.find(u => u.id === String(targetId));
  if (!currentUser || !targetUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  currentUser.superLikes = Array.isArray(currentUser.superLikes) ? currentUser.superLikes : [];
  if (!currentUser.superLikes.includes(targetUser.id)) {
    currentUser.superLikes.push(targetUser.id);
  }

  currentUser.likes = Array.isArray(currentUser.likes) ? currentUser.likes : [];
  if (!currentUser.likes.includes(targetUser.id)) {
    currentUser.likes.push(targetUser.id);
  }

  const mutualLike = Array.isArray(targetUser.likes) && targetUser.likes.includes(currentUser.id);
  let isMatch = false;

  if (mutualLike) {
    currentUser.matches = Array.isArray(currentUser.matches) ? currentUser.matches : [];
    targetUser.matches = Array.isArray(targetUser.matches) ? targetUser.matches : [];
    if (!currentUser.matches.includes(targetUser.id)) currentUser.matches.push(targetUser.id);
    if (!targetUser.matches.includes(currentUser.id)) targetUser.matches.push(currentUser.id);
    isMatch = true;

    const timestamp = Date.now();
    currentUser.notifications = Array.isArray(currentUser.notifications) ? currentUser.notifications : [];
    targetUser.notifications = Array.isArray(targetUser.notifications) ? targetUser.notifications : [];
    currentUser.notifications.push({ id: `notif-${timestamp}-${Math.random().toString(36).slice(2, 8)}`, type: 'match', text: `You matched with ${targetUser.name}!`, timestamp, read: false });
    targetUser.notifications.push({ id: `notif-${timestamp}-${Math.random().toString(36).slice(2, 8)}`, type: 'match', text: `You matched with ${currentUser.name}!`, timestamp, read: false });
  }

  await saveUsers(users);
  return res.json({ success: true, isMatch, message: isMatch ? `Super like matched with ${targetUser.name}!` : 'Super like sent' });
});

app.get('/matches', authMiddleware, async (req, res) => {
  const users = await loadUsers();
  const currentUser = users.find(u => u.id === req.userId);
  if (!currentUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const matches = (currentUser.matches || [])
    .map(matchId => users.find(u => u.id === matchId))
    .filter(Boolean)
    .map(cleanUserForClient);

  return res.json({ success: true, matches });
});

app.get('/notifications', authMiddleware, async (req, res) => {
  const users = await loadUsers();
  const currentUser = users.find(u => u.id === req.userId);
  if (!currentUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  return res.json({ success: true, notifications: currentUser.notifications || [] });
});

app.get('/messages/threads', authMiddleware, async (req, res) => {
  const users = await loadUsers();
  const currentUser = users.find(u => String(u.id) === String(req.userId));
  if (!currentUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const messages = await loadMessages();
  const threadMap = new Map();

  messages
    .filter(msg => String(msg.from) === String(req.userId) || String(msg.to) === String(req.userId))
    .forEach((msg) => {
      const partnerId = String(msg.from) === String(req.userId) ? String(msg.to) : String(msg.from);
      const current = threadMap.get(partnerId) || {
        id: partnerId,
        lastMessage: '',
        lastTimestamp: 0,
      };

      if (!current.name || msg.timestamp > current.lastTimestamp) {
        const partner = users.find(u => String(u.id) === partnerId);
        if (partner) {
          current.name = partner.name || 'Unknown';
          current.photo = partner.photo || partner.avatar || '';
        }
      }

      if (msg.timestamp >= current.lastTimestamp) {
        current.lastTimestamp = msg.timestamp;
        current.lastMessage = msg.text ? msg.text : (msg.photo ? '📷 Photo' : '');
      }

      threadMap.set(partnerId, current);
    });

  const threads = Array.from(threadMap.values())
    .sort((a, b) => b.lastTimestamp - a.lastTimestamp);

  return res.json({ success: true, threads });
});

app.get('/likes', authMiddleware, async (req, res) => {
  const users = await loadUsers();
  const currentUser = users.find(u => u.id === req.userId);
  if (!currentUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const likedBy = users
    .filter(u => Array.isArray(u.likes) && u.likes.includes(currentUser.id))
    .map(u => ({
      ...cleanUserForClient(u),
      isMatch: Array.isArray(currentUser.matches) && currentUser.matches.includes(u.id)
    }));

  return res.json({ success: true, likes: likedBy });
});

app.get('/messages/conversation/:contactId', authMiddleware, async (req, res) => {
  const contactId = req.params.contactId;
  if (!contactId) {
    return res.status(400).json({ success: false, message: 'Missing contactId' });
  }

  const messages = await loadMessages();
  const conversation = messages
    .filter(msg => {
      return (msg.from === req.userId && msg.to === contactId) || (msg.from === contactId && msg.to === req.userId);
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  return res.json({ success: true, messages: conversation });
});

app.post('/messages/send', authMiddleware, upload.single('photo'), async (req, res) => {
  const { recipientId, text } = req.body;
  const photo = req.file ? `/uploads/${req.file.filename}` : '';
  const trimmedText = String(text || '').trim();

  if (!recipientId || (!trimmedText && !photo)) {
    return res.status(400).json({ success: false, message: 'recipientId and text or photo are required' });
  }

  const users = await loadUsers();
  const recipient = users.find(u => u.id === String(recipientId));
  if (!recipient) {
    return res.status(404).json({ success: false, message: 'Recipient not found' });
  }

  const messages = await loadMessages();
  const message = {
    id: getRandomId(),
    from: req.userId,
    to: recipient.id,
    text: sanitizeString(trimmedText),
    photo,
    timestamp: Date.now(),
  };
  messages.push(message);
  await saveMessages(messages);

  if (recipient.id && recipient.id.startsWith('seed_')) {
    scheduler.queueInteractionIfOffline(recipient.id, {
      type: 'message',
      fromUserId: req.userId,
      fromName: req.user?.name || '',
      text: trimmedText
    });
  }

  return res.json({ success: true, message });
});

app.get('/api/user/me', authMiddleware, async (req, res) => {
  return res.json({ success: true, user: cleanUserForClient(req.user) });
});

app.put('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const { name, avatar, bio, interests } = req.body;
    const users = await loadUsers();
    const currentUser = users.find(u => u.id === req.userId);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    currentUser.name = sanitizeString(name);
    currentUser.bio = sanitizeString(bio || '');
    currentUser.avatar = sanitizeString(avatar || '');

    let interestArray = [];
    if (typeof interests === 'string') {
      interestArray = interests.split(',').map(i => sanitizeString(i)).filter(Boolean);
    } else if (Array.isArray(interests)) {
      interestArray = interests.map(i => sanitizeString(i)).filter(Boolean);
    }
    currentUser.interests = interestArray.slice(0, 5);
    currentUser.updatedAt = Date.now();

    await saveUsers(users);
    return res.json({ success: true, user: cleanUserForClient(currentUser) });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ success: false, message: 'Unable to update profile' });
  }
});

app.get('/profile/gallery', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    return res.json({ success: true, gallery: Array.isArray(user.gallery) ? user.gallery : [] });
  } catch (err) {
    console.error('Gallery fetch error:', err);
    return res.status(500).json({ success: false, message: 'Unable to fetch gallery' });
  }
});

app.post('/profile/gallery', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Missing image file' });
    }

    const users = await loadUsers();
    const currentUser = users.find(u => u.id === req.userId);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const image = { id: getRandomId(), url: `/uploads/${req.file.filename}` };
    currentUser.gallery = Array.isArray(currentUser.gallery) ? currentUser.gallery : [];
    currentUser.gallery.push(image);
    await saveUsers(users);

    return res.json({ success: true, image });
  } catch (err) {
    console.error('Gallery upload error:', err);
    return res.status(500).json({ success: false, message: 'Unable to upload gallery image' });
  }
});

app.delete('/profile/gallery/:id', authMiddleware, async (req, res) => {
  try {
    const imageId = req.params.id;
    if (!imageId) {
      return res.status(400).json({ success: false, message: 'Missing image id' });
    }

    const users = await loadUsers();
    const currentUser = users.find(u => u.id === req.userId);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const existingGallery = Array.isArray(currentUser.gallery) ? currentUser.gallery : [];
    const imageToRemove = existingGallery.find((img) => img.id === imageId);
    if (!imageToRemove) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    currentUser.gallery = existingGallery.filter((img) => img.id !== imageId);
    await saveUsers(users);

    if (imageToRemove.url && imageToRemove.url.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, imageToRemove.url.replace('/uploads/', 'uploads/'));
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          await fs.unlink(filePath);
        }
      } catch (unlinkErr) {
        // ignore missing or unlink errors
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Gallery delete error:', err);
    return res.status(500).json({ success: false, message: 'Unable to delete gallery image' });
  }
});

app.put('/api/user/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }

    const users = await loadUsers();
    const currentUser = users.find(u => u.id === req.userId);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const matches = await bcrypt.compare(currentPassword, currentUser.passwordHash || '');
    if (!matches) {
      return res.status(403).json({ success: false, message: 'Current password is incorrect' });
    }

    currentUser.passwordHash = await bcrypt.hash(newPassword, 10);
    currentUser.updatedAt = Date.now();
    await saveUsers(users);

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password update error:', err);
    return res.status(500).json({ success: false, message: 'Unable to update password' });
  }
});

app.delete('/api/user/account', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password confirmation is required' });
    }

    const users = await loadUsers();
    const currentUser = users.find(u => u.id === req.userId);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const matches = await bcrypt.compare(password, currentUser.passwordHash || '');
    if (!matches) {
      return res.status(403).json({ success: false, message: 'Password confirmation did not match' });
    }

    const remainingUsers = users.filter(u => u.id !== currentUser.id).map(u => ({
      ...u,
      likes: Array.isArray(u.likes) ? u.likes.filter(id => id !== currentUser.id) : [],
      passed: Array.isArray(u.passed) ? u.passed.filter(id => id !== currentUser.id) : [],
      matches: Array.isArray(u.matches) ? u.matches.filter(id => id !== currentUser.id) : [],
      notifications: Array.isArray(u.notifications) ? u.notifications.filter(note => note.partnerId !== currentUser.id) : [],
    }));

    await saveUsers(remainingUsers);
    const messages = await loadMessages();
    await saveMessages(messages.filter(msg => msg.from !== currentUser.id && msg.to !== currentUser.id));

    return res.json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Delete account error:', err);
    return res.status(500).json({ success: false, message: 'Unable to delete account' });
  }
});

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html')); 
  });
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });

  socket.on('request_status_check', async () => {
    try {
      const users = await loadUsers();
      const statuses = users
        .filter(u => u.id && u.id.startsWith('seed_'))
        .map(u => ({
          userId: u.id,
          isOnline: scheduler.isSeededUserOnline(u.id),
          name: u.name
        }));
      socket.emit('status_check_response', statuses);
    } catch (err) {
      console.error('Error in status check:', err);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok' });
});

// Seeded user status endpoint
app.get('/seed-users/status', async (req, res) => {
  try {
    const users = await loadUsers();
    scheduler.initializeAllSeededUsers(users);
    const statuses = scheduler.getStatusSummary();
    res.json({ success: true, statuses });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Unable to retrieve statuses' });
  }
});

async function loadFaceApiModels() {
  if (!canvasAvailable) {
    console.warn('⚠️  Skipping FaceAPI model loading - canvas/faceapi not available');
    return;
  }
  
  const modelPath = path.join(__dirname, 'node_modules', '@vladmandic', 'face-api', 'model');
  await faceapi.tf.setBackend('tensorflow');
  await faceapi.tf.ready();
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
  console.log('FaceAPI models loaded from', modelPath);
}

async function start() {
  await ensureStorage();
  await db.initDb();
  await loadFaceApiModels();
  
  // Initialize seeded user scheduler on startup
  const users = await loadUsers();
  scheduler.setIoInstance(io);
  scheduler.setResponseHandlers({
    autoLike: persistSeedAutoLike,
    sendMessage: persistSeedAutoMessage,
  });
  scheduler.initializeAllSeededUsers(users);
  console.log('Seeded user scheduler initialized');

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Custom backend running on http://0.0.0.0:${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    scheduler.stopAllSchedulers();
    process.exit(0);
  });
}

start().catch(err => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});
