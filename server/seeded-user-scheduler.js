/**
 * Seeded User Online/Offline Scheduler
 * Manages realistic online/offline cycles for bot users with ID starting with "seed_"
 */

// Configuration (can be adjusted via environment variables)
const CONFIG = {
  ONLINE_DURATION_MS: Number(process.env.SEED_ONLINE_DURATION || 3600000), // 1 hour
  OFFLINE_DURATION_MS: Number(process.env.SEED_OFFLINE_DURATION || 7200000), // 2 hours
  RESPONSE_DELAY_MIN_MS: Number(process.env.SEED_RESPONSE_DELAY_MIN || 30000), // 30 seconds
  RESPONSE_DELAY_MAX_MS: Number(process.env.SEED_RESPONSE_DELAY_MAX || 180000), // 3 minutes
  STARTER_MESSAGES: [
    'Hey! 👋',
    'Hi there! How are you?',
    'What\'s up?',
    'Hey, how are you doing?',
    'Nice to meet you! 😊',
    'Hi! Let\'s chat?',
    'Hey, what\'s new?',
    'How was your day?',
    'So tell me about yourself!',
    'You seem interesting, let\'s talk!',
    'Hey! What do you like to do for fun?',
    'Haha, nice profile! 😄',
  ]
};

// State tracking
const seededUserState = {}; // userId -> { isOnline, lastStatusChange, pendingInteractions }
const timers = {}; // userId -> { onlineTimer, offlineTimer, responseTimer }

/**
 * Calculate a staggered start time offset for a user based on their ID
 * This makes all seeded users not go online/offline at the same time
 */
function calculateStartOffset(userId) {
  // Hash the user ID to a consistent number
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const offset = Math.abs(hash) % (CONFIG.ONLINE_DURATION_MS + CONFIG.OFFLINE_DURATION_MS);
  return offset;
}

/**
 * Initialize scheduler for a seeded user
 */
function initializeSeededUser(userId) {
  if (!userId.startsWith('seed_')) return;
  
  if (seededUserState[userId]) return; // Already initialized

  const offset = calculateStartOffset(userId);
  const isCurrentlyOnline = offset < CONFIG.ONLINE_DURATION_MS;

  seededUserState[userId] = {
    isOnline: isCurrentlyOnline,
    lastStatusChange: Date.now(),
    pendingInteractions: [], // { type: 'like'|'message', fromUserId, text?, timestamp }
    nextStatusChangeIn: isCurrentlyOnline 
      ? CONFIG.ONLINE_DURATION_MS - offset
      : CONFIG.ONLINE_DURATION_MS + CONFIG.OFFLINE_DURATION_MS - offset
  };

  scheduleNextStatusChange(userId);
}

/**
 * Schedule the next online/offline status change for a user
 */
function scheduleNextStatusChange(userId) {
  if (!seededUserState[userId]) return;

  const state = seededUserState[userId];
  const delay = state.nextStatusChangeIn || (state.isOnline ? CONFIG.ONLINE_DURATION_MS : CONFIG.OFFLINE_DURATION_MS);

  // Clear existing timers
  if (timers[userId]?.onlineTimer) clearTimeout(timers[userId].onlineTimer);
  if (timers[userId]?.offlineTimer) clearTimeout(timers[userId].offlineTimer);

  timers[userId] = timers[userId] || {};
  
  const changeTimer = setTimeout(() => {
    toggleUserStatus(userId);
    scheduleNextStatusChange(userId);
  }, delay);

  if (state.isOnline) {
    timers[userId].onlineTimer = changeTimer;
  } else {
    timers[userId].offlineTimer = changeTimer;
  }
}

// Global io instance for broadcasting
let globalIo = null;

/**
 * Set the Socket.io instance for broadcasting status changes
 */
function setIoInstance(io) {
  globalIo = io;
}

/**
 * Toggle a user's online/offline status and trigger delayed responses if coming online
 */
function toggleUserStatus(userId, io = null) {
  if (!seededUserState[userId]) return;

  const state = seededUserState[userId];
  state.isOnline = !state.isOnline;
  state.lastStatusChange = Date.now();
  state.nextStatusChangeIn = state.isOnline ? CONFIG.ONLINE_DURATION_MS : CONFIG.OFFLINE_DURATION_MS;

  // Broadcast status change to all connected clients
  const broadcastIo = io || globalIo;
  if (broadcastIo) {
    broadcastIo.emit('seed_user_status_changed', {
      userId,
      isOnline: state.isOnline,
      timestamp: Date.now()
    });
  }

  // If coming online, schedule responses to pending interactions
  if (state.isOnline && state.pendingInteractions.length > 0) {
    scheduleResponsesToInteractions(userId, state.pendingInteractions, broadcastIo);
  }
}

/**
 * Add an interaction (like, message) to a user's pending queue if they're offline
 */
function queueInteractionIfOffline(userId, interaction) {
  if (!seededUserState[userId]) initializeSeededUser(userId);

  const state = seededUserState[userId];
  if (!state.isOnline) {
    state.pendingInteractions.push({
      ...interaction,
      timestamp: Date.now()
    });
    return true; // Was queued
  }
  return false; // User is online, no queueing needed
}

/**
 * Schedule delayed responses when a user comes online
 */
function scheduleResponsesToInteractions(userId, pendingInteractions, io = null, loadUsersFunc = null, sendMessageFunc = null) {
  if (pendingInteractions.length === 0) return;

  // Pick 1-2 random interactions to respond to
  const numResponses = Math.min(1 + Math.floor(Math.random() * 2), pendingInteractions.length);
  const responsesToIndices = new Set();
  
  while (responsesToIndices.size < numResponses) {
    responsesToIndices.add(Math.floor(Math.random() * pendingInteractions.length));
  }

  let responseCount = 0;
  responsesToIndices.forEach(idx => {
    const interaction = pendingInteractions[idx];
    const responseDelay = CONFIG.RESPONSE_DELAY_MIN_MS + Math.random() * (CONFIG.RESPONSE_DELAY_MAX_MS - CONFIG.RESPONSE_DELAY_MIN_MS);

    const responseTimer = setTimeout(async () => {
      try {
        if (interaction.type === 'like') {
          // Respond with a like back
          if (io) {
            io.emit('seed_auto_like', {
              seedUserId: userId,
              targetUserId: interaction.fromUserId,
              timestamp: Date.now()
            });
          }
        } else if (interaction.type === 'message') {
          // Send a starter message back
          const message = CONFIG.STARTER_MESSAGES[Math.floor(Math.random() * CONFIG.STARTER_MESSAGES.length)];
          if (sendMessageFunc) {
            await sendMessageFunc(userId, interaction.fromUserId, message);
          }
          if (io) {
            io.emit('seed_auto_message', {
              seedUserId: userId,
              targetUserId: interaction.fromUserId,
              message,
              timestamp: Date.now()
            });
          }
        }
      } catch (err) {
        console.error(`Error sending delayed response from ${userId}:`, err);
      }
    }, responseDelay);

    if (!timers[userId]) timers[userId] = {};
    if (!timers[userId].responseTimers) timers[userId].responseTimers = [];
    timers[userId].responseTimers.push(responseTimer);

    responseCount++;
  });

  // Clear the pending interactions after scheduling responses
  if (timers[userId]) {
    pendingInteractions.length = 0;
  }
}

/**
 * Check if a seeded user is currently online
 */
function isSeededUserOnline(userId) {
  if (!userId.startsWith('seed_')) return true; // Non-seeded users are always considered online
  if (!seededUserState[userId]) initializeSeededUser(userId);
  return seededUserState[userId].isOnline;
}

/**
 * Get all online seeded users
 */
function getOnlineSeededUsers() {
  return Object.entries(seededUserState)
    .filter(([_, state]) => state.isOnline)
    .map(([userId]) => userId);
}

/**
 * Stop all schedulers (for cleanup)
 */
function stopAllSchedulers() {
  Object.keys(timers).forEach(userId => {
    if (timers[userId].onlineTimer) clearTimeout(timers[userId].onlineTimer);
    if (timers[userId].offlineTimer) clearTimeout(timers[userId].offlineTimer);
    if (timers[userId].responseTimers) {
      timers[userId].responseTimers.forEach(t => clearTimeout(t));
    }
  });
  Object.keys(timers).length = 0;
}

/**
 * Initialize all seeded users at startup
 */
function initializeAllSeededUsers(users) {
  users
    .filter(u => u.id && u.id.startsWith('seed_'))
    .forEach(u => initializeSeededUser(u.id));
}

/**
 * Get status summary of all seeded users
 */
function getStatusSummary() {
  return Object.entries(seededUserState).map(([userId, state]) => ({
    userId,
    isOnline: state.isOnline,
    lastStatusChange: state.lastStatusChange,
    pendingInteractions: state.pendingInteractions.length
  }));
}

module.exports = {
  CONFIG,
  setIoInstance,
  initializeSeededUser,
  toggleUserStatus,
  scheduleNextStatusChange,
  queueInteractionIfOffline,
  isSeededUserOnline,
  getOnlineSeededUsers,
  stopAllSchedulers,
  initializeAllSeededUsers,
  getStatusSummary,
  scheduleResponsesToInteractions
};
