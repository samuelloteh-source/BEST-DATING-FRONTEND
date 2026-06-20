const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.join(__dirname, 'users.json');

const botUsers = [
  {
    id: 'seed_bot_1',
    name: 'Sophia Chen',
    dob: '1998-03-15',
    bio: 'Love hiking and photography! Always up for spontaneous adventures.',
    email: 'sophia.bot@example.com',
    gender: 'Female',
    country: 'USA',
    state: 'California',
    city: 'San Francisco',
    interests: ['hiking', 'photography', 'travel', 'coffee'],
    photo: 'https://randomuser.me/api/portraits/women/0.jpg'
  },
  {
    id: 'seed_bot_2',
    name: 'Emma Rodriguez',
    dob: '2000-07-22',
    bio: 'Foodie and yoga enthusiast. Let\'s grab brunch?',
    email: 'emma.bot@example.com',
    gender: 'Female',
    country: 'USA',
    state: 'New York',
    city: 'New York',
    interests: ['yoga', 'cooking', 'art', 'wine'],
    photo: 'https://randomuser.me/api/portraits/women/1.jpg'
  },
  {
    id: 'seed_bot_3',
    name: 'Olivia Smith',
    dob: '1996-11-08',
    bio: 'Artist and dog lover. Currently obsessed with pottery.',
    email: 'olivia.bot@example.com',
    gender: 'Female',
    country: 'USA',
    state: 'Texas',
    city: 'Austin',
    interests: ['art', 'dogs', 'pottery', 'music'],
    photo: 'https://randomuser.me/api/portraits/women/2.jpg'
  },
  {
    id: 'seed_bot_4',
    name: 'Isabella Garcia',
    dob: '1999-01-30',
    bio: 'Tech enthusiast and book lover. Startup founder.',
    email: 'isabella.bot@example.com',
    gender: 'Female',
    country: 'USA',
    state: 'California',
    city: 'Los Angeles',
    interests: ['tech', 'books', 'startups', 'gaming'],
    photo: 'https://randomuser.me/api/portraits/women/3.jpg'
  },
  {
    id: 'seed_bot_5',
    name: 'Mia Johnson',
    dob: '1997-05-12',
    bio: 'Fitness trainer and health nut. CrossFit addict.',
    email: 'mia.bot@example.com',
    gender: 'Female',
    country: 'USA',
    state: 'Florida',
    city: 'Miami',
    interests: ['fitness', 'health', 'sports', 'nutrition'],
    photo: 'https://randomuser.me/api/portraits/women/4.jpg'
  }
];

async function addBotUsers() {
  try {
    // Read existing users
    const usersData = await fs.readFile(USERS_FILE, 'utf-8');
    let users = JSON.parse(usersData);

    // Create password hash
    const passwordHash = await bcrypt.hash('password123', 10);

    // Add bot users with all required fields
    const newBotUsers = botUsers.map(bot => ({
      ...bot,
      passwordHash,
      avatar: bot.photo,
      likes: [],
      passed: [],
      matches: [],
      notifications: [],
      emailVerified: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }));

    // Filter out any existing bot users and add new ones
    const existingBotIds = new Set(newBotUsers.map(u => u.id));
    users = users.filter(u => !existingBotIds.has(u.id));
    users.push(...newBotUsers);

    // Write back to file
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    console.log(`✅ Added ${newBotUsers.length} bot users successfully!`);
    console.log('Bot user IDs:', newBotUsers.map(u => u.id).join(', '));
  } catch (err) {
    console.error('❌ Error adding bot users:', err);
    process.exit(1);
  }
}

addBotUsers();
