const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const usersFile = path.join(dataDir, 'users.json');
const password = 'Password123!';
const passwordHash = bcrypt.hashSync(password, 10);

const states = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia',
  'Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland',
  'Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey',
  'New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina',
  'South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'
];

const names = [
  'Ava Brooks','Chloe Carter','Mia Davis','Sophia Evans','Isabella Foster','Emma Garcia','Olivia Harris','Lily Johnson','Grace Kelly','Zoe Lewis',
  'Nora Martin','Ella Nelson','Maya Ortiz','Hannah Perez','Madison Quinn','Lila Reed','Anna Sanders','Jasmine Taylor','Avery Walker','Leah Young',
  'Nina Adams','Clara Bennett','Ruby Campbell','Molly Diaz','Sadie Edwards','Eden Flores','Piper Grant','Sienna Howard','Arianna James','Paige Keller',
  'Violet Lee','Jade Mitchell','Audrey Nichols','Maya Olson','Brooke Phillips','Tessa Robinson','Stella Simmons','Jenna Turner','Mia Underwood','Kyla Vaughn',
  'Audrey Wallace','Maggie Xu','Nina Young','Bianca Zimmerman','Lena Baker','Eden Chen','Sophie Diaz','Caroline Evans','Naomi Fisher','Ariana Green',
  'Fiona Hall','Julia Ingram','Maya Jacobs','Olivia King','Nora Lopez','Penny Morris','Rachel Nguyen','Sofia Owens','Tara Price','Uma Rivera',
  'Wendy Scott','Ximena Taylor','Yara Upton','Zara Vaughn','Abby West','Bella Xu','Cassie Young','Diana Young','Eva Zane','Faye Allen',
  'Gina Brooks','Hope Ellis','Iris Fields','June Grey','Kate Hale','Lily Irwin','Molly Jones','Nora Lane','Opal Moore','Paige North'
];

const interestPool = ['music','travel','fitness','food','movies','reading','art','outdoors','pets','tech','fashion','cooking','yoga','photography','health','dance','hiking','sports','writing','gaming','coffee','beaches','weekend getaways','live music','gardening','self-care','theater','road trips'];
const cities = ['Austin','Boston','Chicago','Denver','Nashville','Portland','Seattle','Miami','San Diego','Phoenix','Atlanta','Charlotte','Dallas','Raleigh','Orlando','San Francisco','Minneapolis','Columbus','Houston','Las Vegas'];

function randomDate(year) {
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function chooseInterests() {
  const count = 3 + Math.floor(Math.random() * 3); // 3-5 interests
  const copy = [...interestPool];
  const selected = [];
  while (selected.length < count) {
    const idx = Math.floor(Math.random() * copy.length);
    selected.push(copy.splice(idx, 1)[0]);
  }
  return selected;
}

function generateBio(interests, city, state, ageGroup) {
  const topInterests = interests.slice(0, 3).map(i => i.toLowerCase()).join(', ');
  const templates = [
    `I love living in ${city}, ${state}, and I spend my free time enjoying ${topInterests}.`,
    `I enjoy ${topInterests}, exploring new spots around ${city}, and I try to stay curious every day.`,
    `I’m a ${ageGroup === 2 ? 'thoughtful' : 'energetic'} woman from ${city} who is always up for ${topInterests}.`,
    `When I’m not working, I’m usually ${topInterests} or planning my next weekend adventure near ${city}.`,
    `I’m into ${topInterests} and I love meeting new people who appreciate good conversation and a little spontaneity.`
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

const seededUsers = [];
for (let i = 0; i < 70; i += 1) {
  const name = names[i] || `User ${i + 1}`;
  const state = states[i % states.length];
  const city = cities[i % cities.length];
  const ageGroup = i % 3; // 0 => 25s, 1 => 30s, 2 => 50s
  const year = ageGroup === 0 ? 1999 : ageGroup === 1 ? 1992 : 1984;
  const dob = randomDate(year);
  const email = `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`;
  const photoIndex = i % 99;
  const photo = `https://randomuser.me/api/portraits/women/${photoIndex}.jpg`;
  const interests = chooseInterests();
  const bio = generateBio(interests, city, state, ageGroup);

  seededUsers.push({
    id: `female-${i + 1}-${Date.now()}`,
    name,
    dob,
    bio,
    email,
    passwordHash,
    photo,
    avatar: photo,
    gender: 'Female',
    country: 'USA',
    state,
    city,
    interests,
    likes: [],
    passed: [],
    matches: [],
    notifications: [],
    emailVerified: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

fs.writeFileSync(usersFile, JSON.stringify(seededUsers, null, 2));
console.log('Seeded', seededUsers.length, 'female users to', usersFile);
