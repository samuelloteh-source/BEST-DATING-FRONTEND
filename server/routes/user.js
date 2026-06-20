const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'sparkdating_jwt_secret';
const MAX_INTERESTS = 5;

function sanitizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function isValidUrl(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    new URL(value);
    return true;
  } catch (err) {
    return false;
  }
}

function cleanUserForClient(user) {
  if (!user) return null;
  const {
    password,
    authToken,
    authTokenExpires,
    emailVerificationToken,
    passwordResetToken,
    passwordResetExpires,
    ...safe
  } = user;

  return {
    ...safe,
    avatar: safe.avatar || '',
    bio: safe.bio || '',
    interests: Array.isArray(safe.interests) ? safe.interests : [],
  };
}

async function loadUsers() {
  return (await db.loadUsersFromDb()) || [];
}

async function saveUsers(users) {
  return db.saveUsersToDb(users || []);
}

async function loadMessages() {
  return (await db.loadMessagesFromDb()) || [];
}

async function saveMessages(messages) {
  return db.saveMessagesToDb(messages || []);
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  const token = typeof authHeader === 'string'
    ? authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : authHeader.trim()
    : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Missing authentication token' });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  if (!payload || !payload.id) {
    return res.status(401).json({ success: false, message: 'Invalid authentication payload' });
  }

  const users = await loadUsers();
  const user = users.find(u => String(u.id) === String(payload.id));
  if (!user) {
    return res.status(401).json({ success: false, message: 'User not found' });
  }

  req.user = user;
  req.userId = String(user.id);
  next();
}

router.get('/me', authMiddleware, async (req, res) => {
  return res.json({ success: true, user: cleanUserForClient(req.user) });
});

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, bio, avatar, interests } = req.body;
    const trimmedName = sanitizeString(name);
    const trimmedBio = sanitizeString(bio);
    const trimmedAvatar = sanitizeString(avatar);

    if (!trimmedName) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    if (trimmedName.length > 100) {
      return res.status(400).json({ success: false, message: 'Name must be 100 characters or fewer' });
    }
    if (trimmedBio.length > 500) {
      return res.status(400).json({ success: false, message: 'Bio must be 500 characters or fewer' });
    }
    if (trimmedAvatar && !isValidUrl(trimmedAvatar)) {
      return res.status(400).json({ success: false, message: 'Avatar must be a valid URL' });
    }

    let interestsArray = [];
    if (typeof interests === 'string') {
      interestsArray = interests
        .split(',')
        .map(item => sanitizeString(item))
        .filter(Boolean);
    } else if (Array.isArray(interests)) {
      interestsArray = interests.map(item => sanitizeString(item)).filter(Boolean);
    }

    if (interestsArray.length > MAX_INTERESTS) {
      interestsArray = interestsArray.slice(0, MAX_INTERESTS);
    }

    const users = await loadUsers();
    const userIndex = users.findIndex(u => String(u.id) === String(req.userId));
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updatedUser = {
      ...users[userIndex],
      name: trimmedName,
      bio: trimmedBio,
      avatar: trimmedAvatar,
      interests: interestsArray,
    };

    users[userIndex] = updatedUser;
    await saveUsers(users);

    return res.json({ success: true, user: cleanUserForClient(updatedUser) });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ success: false, message: 'Unable to update profile' });
  }
});

router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }

    const users = await loadUsers();
    const userIndex = users.findIndex(u => String(u.id) === String(req.userId));
    const user = users[userIndex];

    const isMatch = await bcrypt.compare(currentPassword, user.password || '');
    if (!isMatch) {
      return res.status(403).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    users[userIndex] = {
      ...user,
      password: hashedPassword,
    };
    await saveUsers(users);

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password update error:', err);
    return res.status(500).json({ success: false, message: 'Unable to update password' });
  }
});

async function deleteUserData(userId) {
  const users = await loadUsers();
  const remainingUsers = users.filter(u => String(u.id) !== String(userId));

  remainingUsers.forEach(user => {
    if (Array.isArray(user.likes)) {
      user.likes = user.likes.filter(id => String(id) !== String(userId));
    }
    if (Array.isArray(user.passed)) {
      user.passed = user.passed.filter(id => String(id) !== String(userId));
    }
    if (Array.isArray(user.notifications)) {
      user.notifications = user.notifications.filter(note => String(note.partnerId) !== String(userId));
    }
  });

  await saveUsers(remainingUsers);

  try {
    const messages = await loadMessages();
    const remainingMessages = messages.filter(msg => String(msg.from) !== String(userId) && String(msg.to) !== String(userId));
    await saveMessages(remainingMessages);
  } catch (err) {
    console.warn('Could not clean messages for deleted user:', err);
  }
}

router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password confirmation is required' });
    }

    const users = await loadUsers();
    const user = users.find(u => String(u.id) === String(req.userId));
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) {
      return res.status(403).json({ success: false, message: 'Password confirmation did not match' });
    }

    await deleteUserData(req.userId);
    return res.json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Delete account error:', err);
    return res.status(500).json({ success: false, message: 'Unable to delete account' });
  }
});

module.exports = router;
