const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.join(__dirname, 'users.json');
const existing = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')) : [];
const userCountToAdd = Number(process.argv[2]) || 40;
const passwordHash = bcrypt.hashSync('Password123!', 10);

const maleNames = ['Liam Smith','Noah Johnson','Oliver Williams','Elijah Brown','James Jones','William Garcia','Benjamin Miller','Lucas Davis','Henry Rodriguez','Alexander Martinez','Ethan Clark','Logan Lewis','Mason Lee','Lucas Young','Jackson Allen','Aiden Scott','Jackson Turner','Mateo Hill','Leo Ramirez','Julian Morgan'];
const femaleNames = ['Ava Brooks','Chloe Carter','Mia Davis','Sophia Evans','Isabella Foster','Emma Garcia','Olivia Harris','Lily Johnson','Grace Kelly','Zoe Lewis','Nora Martin','Ella Nelson','Maya Ortiz','Hannah Perez','Madison Quinn','Lila Reed','Anna Sanders','Jasmine Taylor','Avery Walker','Leah Young'];
const states = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'];
const cities = ['Austin','Boston','Chicago','Denver','Nashville','Portland','Seattle','Miami','San Diego','Phoenix','Atlanta','Charlotte','Dallas','Raleigh','Orlando','San Francisco','Minneapolis','Columbus','Houston','Las Vegas'];
const interests = ['Music','Travel','Fitness','Food','Movies','Reading','Art','Outdoors','Pets','Tech','Fashion','Cooking','Yoga','Photography','Health','Dance','Hiking','Sports','Writing','Gaming','Coffee','Beach days','Road trips','Live music','Gardening','Self-care'];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomDateFromAge(age) {
  const year = new Date().getFullYear() - age;
  const m = Math.floor(Math.random() * 12) + 1;
  const d = Math.floor(Math.random() * 28) + 1;
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function pickInterests() {
  const copy = [...interests];
  const cnt = 3 + Math.floor(Math.random() * 3);
  const out = [];
  while (out.length < cnt && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function generateBio(firstName, city, state, interests) {
  const topInterests = interests.slice(0, 3).join(', ');
  const templates = [
    `I love living in ${city}, ${state}, and I spend my free time enjoying ${topInterests}.`,
    `I enjoy ${topInterests}, exploring new spots around ${city}, and I try to stay curious every day.`,
    `I’m a spirited person from ${city} who is always up for ${topInterests}.`,
    `When I’m not working, I’m usually ${topInterests} or planning my next weekend adventure near ${city}.`,
    `I’m into ${topInterests} and I love meeting new people who appreciate good conversation and a little spontaneity.`
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

const newUsers = [];
for (let i = 0; i < userCountToAdd; i += 1) {
  const isFemale = i < Math.ceil(userCountToAdd / 2);
  const nameBase = isFemale ? femaleNames[i % femaleNames.length] : maleNames[i % maleNames.length];
  const name = `${nameBase}${i >= (isFemale ? femaleNames.length : maleNames.length) ? ` ${i + 1}` : ''}`;
  const age = 22 + Math.floor(Math.random() * 17);
  const dob = randomDateFromAge(age);
  const state = rand(states);
  const city = rand(cities);
  const email = `${name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '')}${Math.floor(Math.random() * 900) + 100}@example.com`;
  const gender = isFemale ? 'Female' : 'Male';
  const photoGender = isFemale ? 'women' : 'men';
  const photoIndex = Math.floor(Math.random() * 99);
  const photo = `https://randomuser.me/api/portraits/${photoGender}/${photoIndex}.jpg`;
  const userInterests = pickInterests();
  const id = `${isFemale ? 'female' : 'male'}-${existing.length + i + 1}-${Date.now()}`;

  newUsers.push({
    id,
    name,
    dob,
    bio: generateBio(name.split(' ')[0], city, state, userInterests),
    email,
    passwordHash,
    photo,
    avatar: photo,
    gender,
    country: 'USA',
    state,
    city,
    interests: userInterests,
    likes: [],
    passed: [],
    matches: [],
    notifications: [],
    emailVerified: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

const combined = existing.concat(newUsers);
fs.writeFileSync(USERS_FILE, JSON.stringify(combined, null, 2));
console.log('Appended', newUsers.length, 'new users. Total now:', combined.length);
