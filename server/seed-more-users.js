const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.join(__dirname, 'users.json');
const existing = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE,'utf8')) : [];
const passwordHash = bcrypt.hashSync('Password123!', 10);

const maleNames = ['Liam Smith','Noah Johnson','Oliver Williams','Elijah Brown','James Jones','William Garcia','Benjamin Miller','Lucas Davis','Henry Rodriguez','Alexander Martinez'];
const femaleNames = ['Nora Lane','Olivia Price','Ava Stone','Isla Knight','Maya Brooks','Zoe Cole','Lila Parker','Sophie Bell','Emma Reed','Mia Hunt'];
const states = ['California','Texas','Florida','New York','Pennsylvania','Illinois','Ohio','Georgia','North Carolina','Michigan'];
const interests = ['Music','Travel','Fitness','Food','Movies','Reading','Art','Outdoors','Pets','Tech'];

function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function randomDateFromAge(age){ const year = new Date().getFullYear() - age; const m = Math.floor(Math.random()*12)+1; const d = Math.floor(Math.random()*28)+1; return `${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function pickInterests(){ const copy = [...interests]; const cnt = 2 + Math.floor(Math.random()*4); const out=[]; while(out.length<cnt){ const i = copy.splice(Math.floor(Math.random()*copy.length),1)[0]; out.push(i);} return out; }

function generateBio(firstName, state, interests, isFemale) {
  const topInterests = interests.slice(0,3).join(', ');
  const templates = [
    `I'm ${firstName} from ${state}. I like ${topInterests}.`,
    `I'm ${firstName}, from ${state}. I'm into ${topInterests}.`,
    `${firstName} here from ${state}. I enjoy ${topInterests}.`,
    `I'm all about ${topInterests} and life from ${state}.`,
    `From ${state}, I'm ${firstName} and I love ${topInterests}.`
  ];
  return templates[Math.floor(Math.random()*templates.length)];
}

const newUsers = [];
for(let i=0;i<30;i++){
  const isFemale = i < 20; // 20 female, 10 male
  const name = isFemale ? femaleNames[i%femaleNames.length] + (i>9?` ${i}`:'') : maleNames[i%maleNames.length] + (i>9?` ${i}`:'');
  const age = isFemale ? (25 + Math.floor(Math.random()*20)) : (25 + Math.floor(Math.random()*25));
  const dob = randomDateFromAge(age);
  const state = rand(states);
  const email = name.toLowerCase().replace(/\s+/g,'.') + (Math.floor(Math.random()*900)+100) + '@example.com';
  const gender = isFemale ? 'Female' : 'Male';
  const photoGender = isFemale ? 'women' : 'men';
  const photoIndex = Math.floor(Math.random()*99);
  const photo = `https://randomuser.me/api/portraits/${photoGender}/${photoIndex}.jpg`;
  const userInterests = pickInterests();
  const user = {
    id: `${Date.now()}${i}${Math.floor(Math.random()*1000)}`,
    name,
    dob,
    bio: generateBio(name.split(' ')[0], state, userInterests, isFemale),
    email,
    password: passwordHash,
    photo,
    gender,
    country: state,
    interests: userInterests,
    likes: [],
    messages: [],
    emailVerified: true
  };
  newUsers.push(user);
}

const combined = existing.concat(newUsers);
fs.writeFileSync(USERS_FILE, JSON.stringify(combined, null, 2));
console.log('Appended', newUsers.length, 'new users. Total now:', combined.length);
