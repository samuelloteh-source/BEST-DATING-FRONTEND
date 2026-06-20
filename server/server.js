const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const sendEmail = require('./sendEmail');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dns = require('dns').promises;
const db = require('./db');

dotenv.config();

// Multer with file size limits and image type filter
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

function maybeUpload(req, res, next) {
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (contentType.startsWith('multipart/form-data')) {
    return upload.single('photo')(req, res, next);
  }
  next();
}

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sparkdating_jwt_secret';

const http = require('http');


const typingStatus = {}; // in-memory typing indicator state

// simple in-memory rate limiter store for certain endpoints
const requestRate = {};

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<\/?script[^>]*>/gi, '').trim();
}

// Email transporter singleton (initialized lazily)
let _transporter = null;
async function getTransporter() {
  if (_transporter) return _transporter;

  async function etherealTransporter() {
    const testAccount = await nodemailer.createTestAccount();
    const transport = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
    _transporter = transport;
    return transport;
  }

  const host = process.env.SMTP_HOST;
  if (host && process.env.SMTP_USER) {
    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    try {
      await transport.verify();
      _transporter = transport;
      return _transporter;
    } catch (err) {
      console.warn('SMTP transporter verify failed, falling back to Ethereal', err && err.message ? err.message : err);
      return await etherealTransporter();
    }
  }

  return await etherealTransporter();
}

function generateToken() {
  return crypto.randomBytes(20).toString('hex');
}

async function sendGridMail(mailOptions) {
  if (!process.env.SENDGRID_API_KEY) return null;
  await sendEmail(mailOptions.to, mailOptions.subject, mailOptions.text || 'Please verify your account.')
  return { messageId: 'sendgrid', previewUrl: null };
}

async function sendEmailWithFallback(mailOptions) {
  async function sendWith(transporter) {
    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
    return { messageId: info.messageId, previewUrl };
  }

  try {
    if (process.env.SENDGRID_API_KEY) {
      try {
        return await sendGridMail(mailOptions);
      } catch (sgErr) {
        console.warn('SendGrid send failed, falling back to SMTP/Ethereal:', sgErr && sgErr.message ? sgErr.message : sgErr);
      }
    }

    const transporter = await getTransporter();
    return await sendWith(transporter);
  } catch (e) {
    console.warn('Primary email send failed, falling back to Ethereal:', e && e.message ? e.message : e);
    _transporter = null;
    try {
      const fallbackTransporter = await getTransporter();
      return await sendWith(fallbackTransporter);
    } catch (fallbackError) {
      console.warn('Fallback email send also failed:', fallbackError && fallbackError.message ? fallbackError.message : fallbackError);
      return { error: fallbackError.message || 'Email failed' };
    }
  }
}

async function sendVerificationEmail(user, token) {
  const verifyUrl = `http://localhost:${PORT}/verify-email?token=${token}`;
  return sendEmailWithFallback({
    from: `Spark Dating <${process.env.EMAIL_FROM}>`,
    to: user.email,
    subject: 'Verify your SPARK account',
    html: `<p>Hi ${user.name || ''},</p><p>Please verify your email by clicking <a href="${verifyUrl}">this link</a>.</p>`
  });
}

async function sendPasswordResetEmail(user, token) {
  const resetUrl = `http://localhost:${PORT}/reset-password.html?token=${token}`;
  const result = await sendEmailWithFallback({
    from: `Spark Dating <${process.env.EMAIL_FROM}>`,
    to: user.email,
    subject: 'SPARK password reset',
    html: `<p>Hi ${user.name || ''},</p><p>Reset your password using <a href="${resetUrl}">this link</a>. The link expires in 1 hour.</p>`
  });
  if (result.messageId) {
    console.log('Password reset email sent:', result.messageId);
    if (result.previewUrl) console.log('Preview URL:', result.previewUrl);
  } else {
    console.warn('Failed to send password reset email', result.error);
  }
}

// Middleware - must be before routes
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Simple CORS policy — restrict to allowed origins only
const ALLOWED_ORIGINS = new Set(['http://localhost:3000', 'http://localhost:8080', 'https://yourdomain.com']);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const userRoutes = require('./routes/user');
app.use('/api/user', userRoutes);

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function getCookieValue(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(pair => pair.trim().split('='));
  const match = cookies.find(([key]) => key === name);
  return match ? decodeURIComponent(match[1] || '') : null;
}

function getAuthToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || req.headers['x-auth-token'];
  if (typeof authHeader === 'string') {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    if (token) return token;
  }
  return getCookieValue(req, 'authToken');
}

function isJwtToken(token) {
  return typeof token === 'string' && token.split('.').length === 3;
}

function resolveUserByToken(token, users) {
  if (!token) return null;
  if (isJwtToken(token)) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (!payload || !payload.id) return null;
      return users.find(u => String(u.id) === String(payload.id));
    } catch (err) {
      return null;
    }
  }
  return users.find(u => u.authToken === token && u.authTokenExpires && Date.now() < u.authTokenExpires);
}

function cleanUserForClient(user) {
  if (!user) return null;
  const {
    password,
    emailVerificationToken,
    passwordResetToken,
    passwordResetExpires,
    authToken,
    authTokenExpires,
    ...safe
  } = user;
  return {
    ...safe,
    email: normalizeEmail(safe.email),
    photo: safe.photo || '',
    interests: Array.isArray(safe.interests) ? safe.interests : [],
    gallery: Array.isArray(safe.gallery) ? safe.gallery : [],
    likes: Array.isArray(safe.likes) ? safe.likes : [],
    notifications: Array.isArray(safe.notifications) ? safe.notifications : [],
    lookingFor: safe.lookingFor || 'Any'
  };
}

function getUserById(userId, users = null) {
  const pool = Array.isArray(users) ? users : [];
  return pool.find(u => String(u.id) === String(userId));
}

function createNotification(text, partnerId) {
  return {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'match',
    text: sanitizeString(text),
    partnerId,
    timestamp: Date.now(),
    read: false
  };
}

async function requireAuth(req, res, next) {
  const token = getAuthToken(req);
  const users = await loadUsersFromFile();
  const user = resolveUserByToken(token, users);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid authentication' });
  }

  if (user.suspended) return res.status(403).json({ success: false, message: 'Your account has been suspended for security reasons.' });
  if (user.emailVerified === false) return res.status(403).json({ success: false, message: 'Please verify your email before continuing.' });

  req.userId = String(user.id);
  req.user = user;
  next();
}

// Geo-based access checks removed — no IP-based blocking

// Serve index.html on root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

async function loadUsersFromFile() {
  return db.loadUsersFromDb();
}

async function saveUsersToFile(users) {
  return db.saveUsersToDb(users);
}

async function loadPendingSignupsFromFile() {
  return db.loadPendingSignupsFromDb();
}

async function savePendingSignupsToFile(signups) {
  return db.savePendingSignupsToDb(signups);
}

function cleanupPendingSignups(signups) {
  const now = Date.now();
  return (Array.isArray(signups) ? signups : []).filter(s => !s.expires_at || s.expires_at > now);
}

async function loadMessagesFromFile() {
  return db.loadMessagesFromDb();
}

async function saveMessagesToFile(msgs) {
  return db.saveMessagesToDb(msgs);
}

app.post('/signup', maybeUpload, async (req, res) => {
  try {
    let { name, dob, bio, email, password, country, gender, state } = req.body;
    const lookingFor = sanitizeString(req.body.lookingFor || 'Any');
    let interests = req.body.interests || [];
    if (typeof interests === 'string') {
      interests = interests.split(',').map(i => sanitizeString(i.trim())).filter(Boolean);
    } else if (Array.isArray(interests)) {
      interests = interests.map(i => sanitizeString(i)).filter(Boolean);
    } else {
      interests = [];
    }

    name = sanitizeString(name);
    bio = sanitizeString(bio);
    email = normalizeEmail(sanitizeString(email));
    country = sanitizeString(country);
    gender = sanitizeString(gender);
    state = sanitizeString(state);
    const photo = req.file ? `/uploads/${req.file.filename}` : '';

    console.log('Signup request:', { email, name, dob, bio, country, hasPassword: !!password, hasFile: !!req.file });

    // Relaxed validation: name, dob, email, and password required; interests and photo optional.
    if (!name || !dob || !email || !password) {
      return res.status(400).json({ success: false, message: 'Missing required signup fields.' });
    }

    // Accept any reasonable email domain (no Gmail-only restriction)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }

    // Optional MX check to ensure domain has mail exchangers
    try {
      const domain = email.split('@')[1];
      const mx = await dns.resolveMx(domain);
      if (!mx || mx.length === 0) {
        return res.status(400).json({ success: false, message: 'Email domain does not appear to accept mail.' });
      }
    } catch (e) {
      console.warn('MX lookup failed for', email, e && e.message ? e.message : e);
      // continue — don't block signup solely on MX lookup failure
    }

    // Geolocation-based signup restrictions removed — no country-based blocking

    let [users, pendingSignups] = await Promise.all([loadUsersFromFile(), loadPendingSignupsFromFile()]);
    pendingSignups = cleanupPendingSignups(pendingSignups);

    if (users.find(u => normalizeEmail(u.email) === email)) {
      return res.json({ success: false, message: 'Email already exists' });
    }

    const existingPending = pendingSignups.find(p => normalizeEmail(p.email) === email);
    const hashedPassword = await bcrypt.hash(password, 10);
    const vtoken = existingPending?.token || generateToken();
    const expiresAt = Date.now() + 3600 * 1000;

    const pendingUser = {
      id: existingPending?.id || Date.now().toString(),
      token: vtoken,
      email,
      name,
      dob,
      gender: gender || '',
      country: country || '',
      state: state || '',
      bio,
      password: hashedPassword,
      photo,
      interests,
      lookingFor,
      likes: [],
      messages: [],
      emailVerified: false,
      created_at: Date.now(),
      expires_at: expiresAt
    };

    if (existingPending) {
      pendingSignups = pendingSignups.map(p => normalizeEmail(p.email) === email ? pendingUser : p);
    } else {
      pendingSignups.push(pendingUser);
    }

    await savePendingSignupsToFile(pendingSignups);
    const emailResult = await sendVerificationEmail(pendingUser, vtoken);
    if (emailResult.error) {
      console.warn('Signup email send failed for', email, emailResult.error);
      return res.status(500).json({ success: false, message: 'Unable to send verification email. Please try again later.' });
    }

    console.log('Pending signup created:', email);
    res.json({
      success: true,
      message: 'Please verify your email before logging in.',
      previewUrl: emailResult?.previewUrl || null
    });
  } catch (err) {
    console.error('SIGNUP ERROR:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = normalizeEmail(email);
    const users = await loadUsersFromFile();
    const user = users.find(u => normalizeEmail(u.email) === normalizedEmail);

    if (!user) {
      const pendingSignups = await loadPendingSignupsFromFile();
      const pending = cleanupPendingSignups(pendingSignups).find(p => normalizeEmail(p.email) === normalizedEmail);
      if (pending) {
        return res.json({ success: false, message: 'Please verify your email before logging in.' });
      }
      return res.json({ success: false, message: 'No account found' });
    }
    if (user.suspended) {
      return res.status(403).json({ success: false, message: 'Your account has been suspended for security reasons.' });
    }
    if (user.emailVerified === false) {
      return res.json({ success: false, message: 'Please verify your email before logging in.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.json({ success: false, message: 'Wrong password' });
    }

    user.authToken = generateToken();
    user.authTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await saveUsersToFile(users);

    res.cookie('authToken', user.authToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    });

    const jwtToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, user: cleanUserForClient(user), token: jwtToken });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/resend-verification', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ success: false, message: 'Missing email' });
    // rate-limit resend attempts per email: max 5 per hour
    try {
      const now = Date.now();
      requestRate[email] = requestRate[email] || [];
      // keep only last hour
      requestRate[email] = requestRate[email].filter(ts => now - ts < 3600 * 1000);
      if (requestRate[email].length >= 5) {
        return res.status(429).json({ success: false, message: 'Too many resend requests; try again later.' });
      }
      requestRate[email].push(now);
    } catch (e) {
      console.warn('Resend rate-limit check failed', e && e.message ? e.message : e);
    }
    const [users, pendingSignups] = await Promise.all([loadUsersFromFile(), loadPendingSignupsFromFile()]);
    const pending = cleanupPendingSignups(pendingSignups).find(p => normalizeEmail(p.email) === email);
    const user = users.find(u => normalizeEmail(u.email) === email);

    if (!user && !pending) {
      return res.json({ success: true, message: 'If that email exists, a verification link has been sent.' });
    }

    if (user) {
      if (user.emailVerified === true) {
        return res.json({ success: false, message: 'This account is already verified.' });
      }
      if (!user.emailVerificationToken) {
        user.emailVerificationToken = generateToken();
      }
      await saveUsersToFile(users);
      const emailResult = await sendVerificationEmail(user, user.emailVerificationToken);
      return res.json({ success: true, message: 'Verification email resent. Check your inbox.', previewUrl: emailResult?.previewUrl || null });
    }

    // pending signup exists
    const token = pending.token || generateToken();
    pending.token = token;
    pending.expires_at = Date.now() + 3600 * 1000;
    await savePendingSignupsToFile(pendingSignups);
    const emailResult = await sendVerificationEmail(pending, token);
    return res.json({ success: true, message: 'Verification email resent. Check your inbox.', previewUrl: emailResult?.previewUrl || null });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ success: false, message: 'Unable to resend verification email.' });
  }
});

app.post('/like', requireAuth, async (req, res) => {
  const targetId = req.body.targetId;
  if (!targetId) {
    return res.status(400).json({ success: false, message: 'Missing target user.' });
  }

  const users = await loadUsersFromFile();
  const user = getUserById(req.userId, users);
  const target = getUserById(targetId, users);

  if (!user || !target) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  if (target.suspended || target.emailVerified === false) {
    return res.status(403).json({ success: false, message: 'Target user is not available' });
  }

  if (!user.likes) user.likes = [];
  if (!target.likes) target.likes = [];

  if (!user.likes.includes(targetId)) {
    user.likes.push(targetId);
  }

  const mutual = target.likes.includes(req.userId);
  let response = { success: true, match: false };

  if (mutual) {
    const messageText = `Congratulations ${target.name} like you back`;
    const reverseText = `Congratulations ${user.name} like you back`;

    if (!user.messages) user.messages = [];
    if (!target.messages) target.messages = [];

    const timestamp = Date.now();
    user.messages.push({ from: target.id, to: user.id, text: messageText, timestamp });
    target.messages.push({ from: user.id, to: target.id, text: reverseText, timestamp });

    response = { success: true, match: true, message: messageText, otherName: target.name };
  }

  await saveUsersToFile(users);
  return res.json(response);
});

app.get('/users', requireAuth, async (req, res) => {
  const currentUser = req.user;
  const users = await loadUsersFromFile();
  const usersNoPassword = users
    .filter(u => !u.suspended && u.emailVerified !== false)
    .map(({ password, ...u }) => u);

  // convert bios to first person for front-end display
  function escapeRegExp(string) {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  function toFirstPerson(bio, name) {
    if (!bio || !name) return bio || '';
    try {
      const nameRe = new RegExp('\\b' + escapeRegExp(name) + '\\b\\s+is\\s+a\\s', 'gi');
      bio = bio.replace(nameRe, "I'm a ");
      const nameIsRe = new RegExp('\\b' + escapeRegExp(name) + '\\b\\s+is\\b', 'gi');
      bio = bio.replace(nameIsRe, "I'm");
      // also replace repeated name occurrences like 'Ava is happiest' -> "I'm happiest"
      const nameHapRe = new RegExp('\\b' + escapeRegExp(name) + "\\b\\s+is\\s+", 'gi');
      bio = bio.replace(nameHapRe, "I'm ");
      return bio;
    } catch (e) { return bio; }
  }

  // currentUserId already validated above - use the currentUser already found
  const currentInterests = new Set((currentUser.interests || []).map(i => i.toLowerCase()));
  const otherUsers = usersNoPassword
    .filter(u => u.id !== currentUser.id)
    .map(u => {
      const sharedInterests = (u.interests || []).filter(i => currentInterests.has(i.toLowerCase()));
      return { ...u, bio: toFirstPerson(u.bio, u.name), sharedInterests, sharedInterestCount: sharedInterests.length };
    })
    .sort((a, b) => {
      // prioritize by lookingFor preference
      const pref = (currentUser.lookingFor || 'Any');
      const aMatch = (pref === 'Any') ? 0 : (a.gender === pref ? 1 : 0);
      const bMatch = (pref === 'Any') ? 0 : (b.gender === pref ? 1 : 0);
      const scoreA = (aMatch * 100) + (a.sharedInterestCount || 0);
      const scoreB = (bMatch * 100) + (b.sharedInterestCount || 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (b.interests || []).length - (a.interests || []).length;
    });

  res.json(otherUsers);
});

app.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, user: cleanUserForClient(req.user) });
});

// Admin: suspend/unsuspend a user
app.post('/admin/suspend', async (req, res) => {
  const { userId, suspend, pwd } = req.body;
  if (pwd !== ADMIN_PASSWORD) return res.status(403).json({ success: false, message: 'Forbidden' });
  if (!userId || typeof suspend === 'undefined') return res.status(400).json({ success: false, message: 'Missing params' });
  const users = await loadUsersFromFile();
  const user = users.find(u => String(u.id) === String(userId));
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  user.suspended = !!suspend;
  await saveUsersToFile(users);
  return res.json({ success: true, suspended: user.suspended });
});

// Admin: delete a user by id
app.delete('/admin/user/:id', async (req, res) => {
  const pwd = req.query.pwd || (req.body && req.body.pwd);
  if (pwd !== ADMIN_PASSWORD) return res.status(403).json({ success: false, message: 'Forbidden' });
  const userId = req.params.id;
  if (!userId) return res.status(400).json({ success: false, message: 'Missing id' });
  const users = await loadUsersFromFile();
  const idx = users.findIndex(u => String(u.id) === String(userId));
  if (idx === -1) return res.status(404).json({ success: false, message: 'User not found' });
  const deletedUser = users.splice(idx,1)[0];
  // cleanup likes/messages/matches
  users.forEach(u => {
    if (Array.isArray(u.likes)) u.likes = u.likes.filter(id => String(id) !== String(userId));
    if (Array.isArray(u.messages)) u.messages = u.messages.filter(m => String(m.from) !== String(userId) && String(m.to) !== String(userId));
    if (Array.isArray(u.matches)) u.matches = u.matches.filter(id => String(id) !== String(userId));
  });
  // remove files
  const filesToRemove = [];
  if (deletedUser.photo && deletedUser.photo.startsWith('/uploads/')) filesToRemove.push(path.join(__dirname, deletedUser.photo.replace('/uploads/','uploads/')));
  if (Array.isArray(deletedUser.photos)) deletedUser.photos.forEach(p=>{ if (p && p.startsWith('/uploads/')) filesToRemove.push(path.join(__dirname,p.replace('/uploads/','uploads/'))); });
  filesToRemove.forEach(fp=>{ try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch(e){} });
  await saveUsersToFile(users);
  return res.json({ success: true });
});

app.get('/messages/threads', requireAuth, async (req, res) => {
  const userId = req.userId;
  const users = await loadUsersFromFile();
  const self = getUserById(userId, users);

  if (!self) return res.status(404).json({ success: false, message: 'User not found' });

  const threadIds = new Set();
  (self.messages || []).forEach(msg => {
    threadIds.add(msg.from === userId ? msg.to : msg.from);
  });

  const threads = Array.from(threadIds)
    .map(id => users.find(u => String(u.id) === String(id)))
    .filter(Boolean)
    .map(u => ({ id: u.id, name: u.name, photo: u.photo || '' }));

  res.json({ success: true, threads });
});

app.get('/messages/notifications', requireAuth, async (req, res) => {
  const userId = req.userId;
  const users = await loadUsersFromFile();
  const self = getUserById(userId, users);

  if (!self) return res.status(404).json({ success: false, message: 'User not found' });

  const notifications = (self.messages || [])
    .filter(msg => msg.text && msg.text.toLowerCase().includes('congratulations'))
    .map(msg => {
      const partnerId = msg.from === userId ? msg.to : msg.from;
      const partner = users.find(u => String(u.id) === String(partnerId));
      return {
        id: msg.timestamp,
        partnerId,
        partnerName: partner ? partner.name : 'Unknown',
        text: msg.text,
        timestamp: msg.timestamp
      };
    });

  res.json({ success: true, notifications });
});

app.get('/messages/conversation', requireAuth, async (req, res) => {
  const contactId = req.query.contactId;
  if (!contactId) return res.status(400).json({ success: false, message: 'Missing contactId' });

  const userId = req.userId;
  const self = req.user;

  const conversation = (self.messages || [])
    .filter(msg => {
      const fromContact = msg.from === contactId && (msg.to === userId || !msg.to);
      const toContact = msg.from === userId && msg.to === contactId;
      return fromContact || toContact;
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  res.json({ success: true, messages: conversation });
});

// Verify email
app.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token');

  let [users, pendingSignups] = await Promise.all([loadUsersFromFile(), loadPendingSignupsFromFile()]);
  pendingSignups = cleanupPendingSignups(pendingSignups);
  const pendingIndex = pendingSignups.findIndex(p => p.token === token);
  if (pendingIndex === -1) return res.status(400).send('Invalid or expired token');

  const pending = pendingSignups[pendingIndex];
  const existingUser = users.find(u => normalizeEmail(u.email) === normalizeEmail(pending.email));

  if (existingUser) {
    if (existingUser.emailVerified !== true) {
      existingUser.emailVerified = true;
      delete existingUser.emailVerificationToken;
      await saveUsersToFile(users);
    }
    pendingSignups.splice(pendingIndex, 1);
    await savePendingSignupsToFile(pendingSignups);
    return res.send('<h2>Email verified</h2><p>Your email has been verified. You may now log in.</p>');
  }

  const newUser = {
    ...pending,
    emailVerified: true,
    id: pending.id || Date.now().toString()
  };
  delete newUser.token;
  delete newUser.expires_at;
  delete newUser.created_at;

  users.push(newUser);
  pendingSignups.splice(pendingIndex, 1);
  await saveUsersToFile(users);
  await savePendingSignupsToFile(pendingSignups);

  res.send('<h2>Email verified</h2><p>Your account has been created and verified. You may now log in.</p>');
});

// Request password reset
app.post('/request-password-reset', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ success: false, message: 'Missing email' });
  // rate-limit: max 5 requests per email per hour
  const now = Date.now();
  requestRate[email] = requestRate[email] || [];
  // keep only last hour
  requestRate[email] = requestRate[email].filter(ts => now - ts < 3600 * 1000);
  if (requestRate[email].length >= 5) return res.status(429).json({ success: false, message: 'Too many reset requests; try later.' });
  requestRate[email].push(now);
  const users = await loadUsersFromFile();
  const user = users.find(u => normalizeEmail(u.email) === email);
  if (!user) return res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
  const token = generateToken();
  user.passwordResetToken = token;
  user.passwordResetExpires = Date.now() + 3600 * 1000; // 1 hour
  await saveUsersToFile(users);
  await sendPasswordResetEmail(user, token).catch(()=>{});
  return res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
});

// Reset password
app.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Missing parameters' });
  const users = await loadUsersFromFile();
  const user = users.find(u => u.passwordResetToken === token && u.passwordResetExpires && Date.now() < u.passwordResetExpires);
  if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired token' });
  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    delete user.passwordResetToken;
    delete user.passwordResetExpires;
    delete user.authToken;
    delete user.authTokenExpires;
    await saveUsersToFile(users);
    return res.json({ success: true, message: 'Password reset successful' });
  } catch (e) {
    console.error('Reset error', e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/logout', requireAuth, async (req, res) => {
  const users = await loadUsersFromFile();
  const user = getUserById(req.userId, users);
  if (user) {
    delete user.authToken;
    delete user.authTokenExpires;
    await saveUsersToFile(users);
  }
  res.clearCookie('authToken', { path: '/' });
  res.json({ success: true });
});

app.post('/edit-profile', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const { name, dob, gender, country, state, bio } = req.body;
    const users = await loadUsersFromFile();
    const user = getUserById(req.userId, users);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update user fields
    if (name !== undefined) user.name = sanitizeString(name);
    if (dob !== undefined) user.dob = sanitizeString(dob);
    if (gender !== undefined) user.gender = sanitizeString(gender);
    if (country !== undefined) user.country = sanitizeString(country);
    if (state !== undefined) user.state = sanitizeString(state);
    if (bio !== undefined) user.bio = sanitizeString(bio);
    
    // Update photo if provided
    if (req.file) {
      user.photo = `/uploads/${req.file.filename}`;
    }

    await saveUsersToFile(users);

    console.log('Profile updated:', req.userId);
    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword });
  } catch (err) {
    console.error('EDIT PROFILE ERROR:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Profile gallery endpoints
app.get('/profile/gallery', requireAuth, (req, res) => {
  const user = req.user;
  const gallery = user.gallery || [];
  res.json({ success: true, gallery });
});

app.post('/profile/gallery', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Missing image file' });

  const users = await loadUsersFromFile();
  const user = getUserById(req.userId, users);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const image = { id: Date.now().toString(), url: `/uploads/${req.file.filename}` };
  user.gallery = user.gallery || [];
  user.gallery.push(image);
  await saveUsersToFile(users);
  res.json({ success: true, image });
});

app.delete('/profile/gallery/:id', requireAuth, async (req, res) => {
  const imageId = req.params.id;
  if (!imageId) return res.status(400).json({ success: false, message: 'Missing params' });

  const users = await loadUsersFromFile();
  const user = getUserById(req.userId, users);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const before = (user.gallery || []).length;
  const removedImage = (user.gallery || []).find(img => img.id === imageId);
  user.gallery = (user.gallery || []).filter(img => img.id !== imageId);
  if (user.gallery.length === before) return res.status(404).json({ success: false, message: 'Image not found' });
  await saveUsersToFile(users);
  if (removedImage && removedImage.url && removedImage.url.startsWith('/uploads/')) {
    try {
      const filePath = path.join(__dirname, removedImage.url.replace('/uploads/', 'uploads/'));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) { /* ignore */ }
  }
  res.json({ success: true });
});

app.delete('/delete-account', requireAuth, async (req, res) => {
  const userId = req.userId;

  const users = await loadUsersFromFile();
  const deleteIndex = users.findIndex(u => String(u.id) === String(userId));
  if (deleteIndex === -1) return res.status(404).json({ success: false, message: 'User not found' });
  const deletedUser = users.splice(deleteIndex, 1)[0];

  users.forEach(u => {
    if (Array.isArray(u.likes)) {
      u.likes = u.likes.filter(id => String(id) !== String(userId));
    }
    if (Array.isArray(u.messages)) {
      u.messages = u.messages.filter(msg => String(msg.from) !== String(userId) && String(msg.to) !== String(userId));
    }
    if (Array.isArray(u.matches)) {
      u.matches = u.matches.filter(id => String(id) !== String(userId));
    }
  });

  try {
    const msgs = await loadMessagesFromFile();
    const remaining = msgs.filter(m => String(m.from) !== String(userId) && String(m.to) !== String(userId));
    await saveMessagesToFile(remaining);
  } catch (e) {
    console.warn('Failed to clean central message store', e);
  }

  const filesToRemove = [];
  if (deletedUser.photo && deletedUser.photo.startsWith('/uploads/')) {
    filesToRemove.push(path.join(__dirname, deletedUser.photo.replace('/uploads/', 'uploads/')));
  }
  if (Array.isArray(deletedUser.gallery)) {
    deletedUser.gallery.forEach(img => {
      if (img && img.url && img.url.startsWith('/uploads/')) {
        filesToRemove.push(path.join(__dirname, img.url.replace('/uploads/', 'uploads/')));
      }
    });
  }

  filesToRemove.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) { console.warn('Failed to remove deleted user file', filePath, e); }
  });

  await saveUsersToFile(users);
  res.clearCookie('authToken', { path: '/' });
  res.json({ success: true });
});

app.post('/messages', requireAuth, upload.single('photo'), async (req, res) => {
  const from = req.userId;
  const { to, text } = req.body;
  const cleanText = sanitizeString(text);
  const photo = req.file ? `/uploads/${req.file.filename}` : '';

  if (!to || (!cleanText && !photo)) {
    return res.status(400).json({ success: false, message: 'Missing message payload.' });
  }

  const users = await loadUsersFromFile();
  const sender = getUserById(from, users);
  const recipient = getUserById(to, users);
  if (!sender || !recipient) {
    return res.status(400).json({ success: false, message: 'Users not found.' });
  }

  if (recipient.suspended || recipient.emailVerified === false) {
    return res.status(403).json({ success: false, message: 'The recipient account is not available.' });
  }

  const message = {
    id: Date.now().toString(),
    from,
    to,
    text: text || '',
    photo,
    timestamp: Date.now()
  };

  sender.messages = sender.messages || [];
  recipient.messages = recipient.messages || [];
  sender.messages.push(message);
  recipient.messages.push(message);

  await saveUsersToFile(users);
  // emit real-time message to both participants (if connected)
  try { io && io.to(to).emit('message', message); } catch (e) {}
  try { io && io.to(from).emit('message', message); } catch (e) {}
  res.json({ success: true, message });
});

app.post('/typing', requireAuth, (req, res) => {
  const contactId = req.body.contactId;
  const typing = req.body.typing;
  if (!contactId || typeof typing !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Missing typing parameters.' });
  }

  const userId = req.userId;
  typingStatus[`${userId}:${contactId}`] = typing;
  try { io && io.to(contactId).emit('typing', { from: userId, typing }); } catch (e) {}
  res.json({ success: true });
});

app.get('/typing', requireAuth, (req, res) => {
  const contactId = req.query.contactId;
  if (!contactId) {
    return res.status(400).json({ success: false, message: 'Missing params.' });
  }

  const userId = req.userId;
  const typing = !!typingStatus[`${contactId}:${userId}`];
  res.json({ success: true, typing });
});

app.put('/messages/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const userId = req.userId;
  const cleanText = sanitizeString(text);
  if (!id || typeof text !== 'string') {
    return res.status(400).json({ success: false, message: 'Missing payload.' });
  }

  const users = await loadUsersFromFile();
  const senderOwns = users.some(user => Array.isArray(user.messages) && user.messages.some(msg => msg.id === id && msg.from === userId));
  if (!senderOwns) {
    return res.status(404).json({ success: false, message: 'Message not found or not editable.' });
  }

  users.forEach(user => {
    if (!user.messages) return;
    user.messages = user.messages.map(msg => {
      if (msg.id === id) {
        return { ...msg, text: cleanText, edited: true };
      }
      return msg;
    });
  });

  await saveUsersToFile(users);
  // update central messages store as well
  try {
    const msgs = await loadMessagesFromFile();
    let updated = false;
    const newMsgs = msgs.map(m => {
      if (m.id === id) { updated = true; return { ...m, text, edited: true }; }
      return m;
    });
    if (updated) await saveMessagesToFile(newMsgs);
  } catch (e) { console.warn('Failed to update central messages store', e); }
  try { io && io.to(userId).emit('edit', { id, text }); } catch (e) {}
  // also notify other participant(s)
  try {
    users.forEach(u => {
      (u.messages || []).forEach(m => { if (m.id === id && m.from !== userId) io && io.to(u.id).emit('edit', { id, text }); });
    });
  } catch (e) {}
  res.json({ success: true });
});

app.delete('/messages/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  if (!id) {
    return res.status(400).json({ success: false, message: 'Missing payload.' });
  }

  const users = await loadUsersFromFile();
  const senderOwns = users.some(user => Array.isArray(user.messages) && user.messages.some(msg => msg.id === id && msg.from === userId));
  if (!senderOwns) {
    return res.status(404).json({ success: false, message: 'Message not found or not deletable.' });
  }

  let deleted = false;
  users.forEach(user => {
    if (!user.messages) return;
    const beforeCount = user.messages.length;
    user.messages = user.messages.filter(msg => msg.id !== id);
    if (user.messages.length < beforeCount) deleted = true;
  });

  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Message not found or not deletable.' });
  }

  await saveUsersToFile(users);
  // remove from central messages store as well
  try {
    const msgs = await loadMessagesFromFile();
    const remaining = msgs.filter(m => m.id !== id);
    await saveMessagesToFile(remaining);
  } catch (e) { console.warn('Failed to delete from central messages store', e); }
  try { io && io.to(userId).emit('delete', { id }); } catch (e) {}
  try {
    users.forEach(u => { io && io.to(u.id).emit('delete', { id }); });
  } catch (e) {}
  res.json({ success: true });
});

// Admin password - MUST be set via environment variable in production for security
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (() => {
  const message = '\n🚨 CRITICAL: ADMIN_PASSWORD environment variable not set!\n   Set it before running: export ADMIN_PASSWORD=<secure-password>\n   On Windows PowerShell use: $env:ADMIN_PASSWORD = "<secure-password>"\n';
  if (process.env.NODE_ENV === 'production') {
    console.error(message);
    process.exit(1);
  }
  const devPassword = `dev-admin-${crypto.randomBytes(4).toString('hex')}`;
  console.warn(`${message}Using temporary development admin password: ${devPassword}`);
  return devPassword;
})();

app.get('/admin', async (req, res) => {
  const password = req.query.pwd;
  
  // If no password or wrong password, show login form
  if (password !== ADMIN_PASSWORD) {
    return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>SPARK Admin Login</title>
      <style>
        body { background: #111; color: white; font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; }
        .box { background: #222; padding: 40px; border-radius: 12px; border: 2px solid red; }
        input { padding: 12px; width: 250px; border-radius: 8px; border: none; margin: 10px 0; }
        button { padding: 12px 24px; background: red; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; }
        button:hover { background: #ff3333; }
        h1 { color: red; margin-top: 0; }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>⚡ SPARK Admin</h1>
        <form>
          <input type="password" name="pwd" placeholder="Enter admin password" required>
          <br>
          <button type="submit">Login</button>
        </form>
      </div>
    </body>
    </html>
    `);
  }
  
  // If password correct, show users table
  const users = await loadUsersFromFile();
  const safeUsers = users.map(({password, ...user}) => user);
  
  let html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>SPARK Admin</title>
    <style>
      body { background: #111; color: white; font-family: Arial; padding: 20px; }
      h1 { color: red; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border: 1px solid #333; padding: 12px; text-align: left; }
      th { background: red; color: white; }
      tr:nth-child(even) { background: #222; }
      img { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; }
    </style>
  </head>
  <body>
    <h1>⚡ SPARK Admin Panel</h1>
    <p>Total Users: ${safeUsers.length}</p>
    <table>
      <tr><th>Photo</th><th>Name</th><th>Email</th><th>DOB</th><th>Bio</th><th>Likes</th><th>Actions</th></tr>
  `;
  
  safeUsers.forEach(u => {
    const suspended = u.suspended ? true : false;
    const suspendLabel = suspended ? 'Unsuspend' : 'Suspend';
    html += `<tr id="user-${u.id}"><td><img src="${u.photo || 'https://via.placeholder.com/50'}"></td><td>${u.name}</td><td>${u.email}</td><td>${u.dob}</td><td>${u.bio}</td><td>${u.likes ? u.likes.length : 0}</td><td><button class="suspendBtn" data-id="${u.id}">${suspendLabel}</button> <button class="deleteBtn" data-id="${u.id}">Delete</button></td></tr>`;
  });
  
  html += `</table>
  <script>
    (function(){
      const pwd = ${JSON.stringify(password)};
      document.querySelectorAll('.suspendBtn').forEach(b=>{
        b.addEventListener('click', async ()=>{
          const id = b.getAttribute('data-id');
          const suspend = b.textContent.trim() !== 'Unsuspend';
          b.disabled = true;
          try {
            const res = await fetch('/admin/suspend', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ userId: id, suspend, pwd }) });
            const j = await res.json();
            if (j.success) {
              b.textContent = suspend ? 'Unsuspend' : 'Suspend';
            } else {
              alert(j.message || 'Failed');
            }
          } catch(e){ console.error(e); alert('Failed'); }
          b.disabled = false;
        });
      });
      document.querySelectorAll('.deleteBtn').forEach(b=>{
        b.addEventListener('click', async ()=>{
          if (!confirm('Delete this user permanently?')) return;
          const id = b.getAttribute('data-id');
          b.disabled = true;
          try {
            const res = await fetch('/admin/user/' + encodeURIComponent(id) + '?pwd=' + encodeURIComponent(pwd), { method: 'DELETE' });
            const j = await res.json();
            if (j.success) {
              const row = document.getElementById('user-' + id);
              if (row) row.remove();
            } else {
              alert(j.message || 'Delete failed');
            }
          } catch(e) { console.error(e); alert('Delete failed'); }
          b.disabled = false;
        });
      });
    })();
  </script>
  </body></html>`;
  res.send(html);
});

// Discovery endpoint - get potential matches
app.get('/discover', requireAuth, async (req, res) => {
  try {
    const users = await loadUsersFromFile();
    const currentUser = getUserById(req.userId, users);
    
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get list of users to exclude (self, already liked, already matched)
    const likedIds = currentUser.likes || [];
    const passedIds = currentUser.passed || [];
    const excludeIds = new Set([req.userId, ...likedIds, ...passedIds]);

    // Filter potential matches
    const potentialMatches = users.filter(u => 
      !excludeIds.has(u.id) && 
      u.emailVerified && 
      !u.suspended &&
      u.id !== req.userId
    );

    // Shuffle and return top 10
    const shuffled = potentialMatches.sort(() => Math.random() - 0.5).slice(0, 10);
    const safe = shuffled.map(u => cleanUserForClient(u));

    res.json({ success: true, users: safe });
  } catch (err) {
    console.error('Discover error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch discover' });
  }
});

// Like a user and check for match
app.post('/discover/like', requireAuth, async (req, res) => {
  try {
    const targetId = req.body.targetId;
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'Missing target user' });
    }

    const users = await loadUsersFromFile();
    const currentUser = getUserById(req.userId, users);
    const targetUser = getUserById(targetId, users);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Add like
    if (!currentUser.likes) currentUser.likes = [];
    if (!currentUser.likes.includes(targetId)) {
      currentUser.likes.push(targetId);
    }

    // Check if target also liked current user (match)
    const isMatch = targetUser.likes && targetUser.likes.includes(req.userId);
    if (isMatch) {
      if (!currentUser.notifications) currentUser.notifications = [];
      if (!targetUser.notifications) targetUser.notifications = [];

      const notificationText = `${targetUser.name || 'Someone'} liked you back — it\'s a match!`; 
      const partnerNotificationText = `${currentUser.name || 'Someone'} liked you back — it\'s a match!`;

      currentUser.notifications.push(createNotification(notificationText, targetId));
      targetUser.notifications.push(createNotification(partnerNotificationText, req.userId));
    }

    await saveUsersToFile(users);

    res.json({ success: true, isMatch, message: isMatch ? 'It\'s a match!' : 'Liked!' });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ success: false, message: 'Failed to like user' });
  }
});

app.get('/notifications', requireAuth, async (req, res) => {
  try {
    const users = await loadUsersFromFile();
    const currentUser = getUserById(req.userId, users);
    if (!currentUser) return res.status(404).json({ success: false, message: 'User not found' });
    const notifications = Array.isArray(currentUser.notifications) ? currentUser.notifications : [];
    res.json({ success: true, notifications });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ success: false, message: 'Failed to load notifications' });
  }
});

// Pass on a user
app.post('/discover/pass', requireAuth, async (req, res) => {
  try {
    const targetId = req.body.targetId;
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'Missing target user' });
    }

    const users = await loadUsersFromFile();
    const currentUser = getUserById(req.userId, users);

    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Add to passed list
    if (!currentUser.passed) currentUser.passed = [];
    if (!currentUser.passed.includes(targetId)) {
      currentUser.passed.push(targetId);
    }

    await saveUsersToFile(users);

    res.json({ success: true });
  } catch (err) {
    console.error('Pass error:', err);
    res.status(500).json({ success: false, message: 'Failed to pass user' });
  }
});

// Get all matches
app.get('/matches', requireAuth, async (req, res) => {
  try {
    const users = await loadUsersFromFile();
    const currentUser = getUserById(req.userId, users);

    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const likedIds = currentUser.likes || [];
    
    // Find mutual likes (matches)
    const matches = users.filter(u => 
      likedIds.includes(u.id) && 
      u.likes && 
      u.likes.includes(req.userId) &&
      u.emailVerified &&
      !u.suspended
    );

    const safeMatches = matches.map(u => cleanUserForClient(u));
    res.json({ success: true, matches: safeMatches });
  } catch (err) {
    console.error('Matches error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch matches' });
  }
});

// Send message to matched user
app.post('/messages/send', requireAuth, async (req, res) => {
  try {
    const { recipientId, text } = req.body;
    if (!recipientId || !text) {
      return res.status(400).json({ success: false, message: 'Missing recipient or text' });
    }

    const users = await loadUsersFromFile();
    const currentUser = getUserById(req.userId, users);
    const recipientUser = getUserById(recipientId, users);

    if (!currentUser || !recipientUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if they're matched
    const isMatched = (currentUser.likes && currentUser.likes.includes(recipientId)) &&
                      (recipientUser.likes && recipientUser.likes.includes(req.userId));

    if (!isMatched) {
      return res.status(403).json({ success: false, message: 'Can only message matched users' });
    }

    // Create message
    const messages = await loadMessagesFromFile();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message = {
      id: messageId,
      from: req.userId,
      to: recipientId,
      text: sanitizeString(text),
      timestamp: Date.now(),
      read: false
    };

    messages.push(message);
    await saveMessagesToFile(messages);

    if (!recipientUser.notifications) recipientUser.notifications = [];
    recipientUser.notifications.push(createNotification(`${currentUser.name || 'Someone'} sent you a message`, req.userId));
    await saveUsersToFile(users);

    res.json({ success: true, message });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// Get conversation with a matched user
app.get('/messages/conversation/:userId', requireAuth, async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    const messages = await loadMessagesFromFile();
    
    // Get messages between current user and other user
    const conversation = messages.filter(m => 
      (m.from === req.userId && m.to === otherUserId) ||
      (m.from === otherUserId && m.to === req.userId)
    ).sort((a, b) => a.timestamp - b.timestamp);

    res.json({ success: true, messages: conversation });
  } catch (err) {
    console.error('Get conversation error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch conversation' });
  }
});

// Create HTTP server and attach Socket.io for real-time messaging
const server = http.createServer(app);
const { Server: IOServer } = require('socket.io');
const io = new IOServer(server, { cors: { origin: '*' } });

io.on('connection', async (socket) => {
  const token = getCookieValue({ headers: { cookie: socket.handshake.headers.cookie || '' } }, 'authToken');
  const users = await loadUsersFromFile();
  const user = token ? users.find(u => u.authToken === token && u.authTokenExpires && Date.now() < u.authTokenExpires) : null;
  if (user) {
    socket.userId = String(user.id);
    socket.join(socket.userId);
    console.log('Socket connected auth user', socket.userId, socket.id);
  } else {
    console.log('Socket connected anonymous', socket.id);
  }

  socket.on('join', () => {
    if (socket.userId) socket.join(socket.userId);
  });

  socket.on('typing', (data) => {
    if (!socket.userId || !data || !data.contactId) return;
    io.to(data.contactId).emit('typing', { from: socket.userId, typing: !!data.typing });
  });
});

async function startServer() {
  await db.initDb();
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});