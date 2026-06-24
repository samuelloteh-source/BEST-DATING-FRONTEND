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
let globalResponseHandlers = {
  autoLike: null,
  sendMessage: null,
};

const RESPONSE_KEYWORDS = [
  {
    keywords: ['hi', 'hello', 'hey', 'hiya', 'hola', 'howdy'],
    responses: [
      'Hey there! What are you up to today?',
      'Hi! I was just browsing profiles — how are you?',
      'Hello! Tell me something fun about your day.',
    ]
  },
  {
    keywords: ['how are you', 'how r you', 'how r u', 'how are u'],
    responses: [
      'I’m doing great, thanks! How about you?',
      'Feeling good today — what about you?',
      'I’m doing well! What’s been the best part of your day?',
    ]
  },
  {
    keywords: ['work', 'job', 'career', 'office', 'boss'],
    responses: [
      'Work life can be wild. What do you enjoy most about your job?',
      'That sounds interesting — what made you choose that career?',
      'Tell me more about what you do. I love hearing about people’s passions.',
    ]
  },
  {
    keywords: ['music', 'song', 'band', 'concert'],
    responses: [
      'Music is such a vibe. What song can you not stop playing?',
      'I love a good playlist. What was the last concert you went to?',
      'Do you have a favorite band or artist right now?',
    ]
  },
  {
    keywords: ['movie', 'film', 'show', 'series', 'tv'],
    responses: [
      'I’m always looking for a good show. Any recommendations?',
      'Movies are perfect for a cozy night. What’s your favorite?',
      'I love a great series. What have you watched lately?',
    ]
  },
  {
    keywords: ['travel', 'trip', 'vacation', 'journey', 'flight'],
    responses: [
      'Travel is the best. Where was your last adventure?',
      'I love exploring new places — what’s at the top of your bucket list?',
      'Any dream destination you’d love to visit next?',
    ]
  },
  {
    keywords: ['food', 'restaurant', 'eat', 'dinner', 'lunch', 'coffee'],
    responses: [
      'Food talk is my favorite. What’s your go-to meal?',
      'I enjoy trying new places. Any favorite restaurant near you?',
      'Are you more of a coffee or dessert person?',
    ]
  },
  {
    keywords: ['pet', 'dog', 'cat', 'animals', 'puppy', 'kitten'],
    responses: [
      'I love animals too! Do you have any pets?',
      'Pets make life better — are you a dog person or a cat person?',
      'Tell me about your furry friend if you have one!',
    ]
  },
  {
    keywords: ['weekend', 'party', 'fun', 'hobby', 'hobbies', 'sports'],
    responses: [
      'Weekends are perfect for relaxing. What do you usually do?',
      'That sounds fun. What’s your favorite hobby?',
      'I’m always up for trying new things. What’s a hobby you love?',
    ]
  },
  {
    keywords: ['photo', 'pic', 'picture', 'selfie'],
    responses: [
      'Your profile pic is great! What’s the story behind it?',
      'You have a nice photo — do you enjoy photography?',
      'Selfies are fun. What made you choose that one?',
    ]
  }
];

function pickSeedResponseForMessage(incomingText, fromName = '') {
  const text = String(incomingText || '').toLowerCase().trim();
  const safeName = fromName ? ` ${fromName}` : '';
  let chosenResponses = [];

  for (const rule of RESPONSE_KEYWORDS) {
    if (rule.keywords.some(keyword => text.includes(keyword))) {
      chosenResponses = rule.responses;
      break;
    }
  }

  if (!chosenResponses.length) {
    chosenResponses = [
      `That’s interesting${safeName}! Tell me more about it.`,
      `I like hearing that${safeName}. What else do you enjoy?`,
      `Nice! I’d love to know more about that.`,
      `Cool! How did you get into that?`,
    ];
  }

  const response = chosenResponses[Math.floor(Math.random() * chosenResponses.length)];
  return response.replace('{name}', fromName || 'there');
}

/**
 * Set the Socket.io instance for broadcasting status changes
 */
function setIoInstance(io) {
  globalIo = io;
}

/**
 * Set persistence handlers for seeded responses
 */
function setResponseHandlers(handlers = {}) {
  globalResponseHandlers = {
    ...globalResponseHandlers,
    ...handlers,
  };
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
  state.pendingInteractions.push({
    ...interaction,
    timestamp: Date.now()
  });

  if (state.isOnline) {
    scheduleResponsesToInteractions(userId, state.pendingInteractions);
    return false; // handled immediately
  }

  return true; // queued until user comes online
}

/**
 * Schedule delayed responses when a user comes online
 */
function scheduleResponsesToInteractions(userId, pendingInteractions, io = null, autoLikeFunc = null, sendMessageFunc = null) {
  if (pendingInteractions.length === 0) return;

  const autoLikeHandler = autoLikeFunc || globalResponseHandlers.autoLike;
  const sendMessageHandler = sendMessageFunc || globalResponseHandlers.sendMessage;

  // Pick 1-2 random interactions to respond to
  const numResponses = Math.min(1 + Math.floor(Math.random() * 2), pendingInteractions.length);
  const responsesToIndices = new Set();
  
  while (responsesToIndices.size < numResponses) {
    responsesToIndices.add(Math.floor(Math.random() * pendingInteractions.length));
  }

  responsesToIndices.forEach(idx => {
    const interaction = pendingInteractions[idx];
    const responseDelay = CONFIG.RESPONSE_DELAY_MIN_MS + Math.random() * (CONFIG.RESPONSE_DELAY_MAX_MS - CONFIG.RESPONSE_DELAY_MIN_MS);

    const responseTimer = setTimeout(async () => {
      try {
        if (interaction.type === 'like') {
          if (autoLikeHandler) {
            await autoLikeHandler(userId, interaction.fromUserId);
          }
          if (io) {
            io.emit('seed_auto_like', {
              seedUserId: userId,
              targetUserId: interaction.fromUserId,
              timestamp: Date.now()
            });
          }
        } else if (interaction.type === 'message') {
          const message = pickSeedResponseForMessage(interaction.text, interaction.fromName);
          if (sendMessageHandler) {
            await sendMessageHandler(userId, interaction.fromUserId, message);
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
  });

  // Clear the pending interactions after scheduling responses
  pendingInteractions.length = 0;
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
  setResponseHandlers,
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
