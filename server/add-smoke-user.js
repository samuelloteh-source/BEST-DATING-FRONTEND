const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
(async ()=>{
  const usersPath = path.join(__dirname,'users.json');
  const raw = fs.readFileSync(usersPath,'utf8');
  const users = JSON.parse(raw);
  const email = `smoke_injected_${Date.now()}@example.com`;
  const password = 'Password123!';
  const hash = bcrypt.hashSync(password,10);
  const newUser = {
    id: Date.now().toString(),
    name: 'Smoke Injected',
    dob: '1990-01-01',
    bio: 'This is a smoke test account.',
    email,
    password: hash,
    photo: '/uploads/db151f41902aafd33fac.jpg',
    gender: 'Other',
    country: 'Testland',
    interests: ['Testing'],
    likes: [],
    messages: [],
    emailVerified: true,
    photos: [],
    icebreakers: []
  };
  users.unshift(newUser);
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
  console.log('Inserted user:', email);
})();
