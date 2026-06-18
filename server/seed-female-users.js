const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const usersFile = path.join(__dirname, 'users.json');
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

const interestPool = ['Music','Travel','Fitness','Food','Movies','Reading','Art','Outdoors','Pets','Tech','Fashion','Cooking','Yoga','Photography','Health','Dance','Hiking','Sports','Writing','Gaming'];

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

function generateBio(interests, state, ageGroup) {
  const topInterests = interests.slice(0, 3).join(', ');
  const templates = [
    `I'm a ${ageGroup === 2 ? 'well-traveled' : 'fun-loving'} woman from ${state} who enjoys ${topInterests}.`,
    `I'm passionate about ${topInterests} and living life to the fullest from ${state}.`,
    `I love ${topInterests} and I'm always looking for an adventure from ${state}.`,
    `From ${state}, I'm ${ageGroup === 2 ? 'a seasoned traveler' : 'someone who loves exploring'} and enjoying ${topInterests}.`,
    `I'm into ${topInterests} and making the most of life from ${state}.`
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

const seededUsers = [];
for (let i = 0; i < 70; i += 1) {
  const name = names[i] || `User ${i + 1}`;
  const state = states[i % states.length];
  const ageGroup = i % 3; // 0 => 25s, 1 => 30s, 2 => 50s
  const year = ageGroup === 0 ? 2001 : ageGroup === 1 ? 1996 : 1976;
  const dob = randomDate(year);
  const email = `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`;
  const photoIndex = i % 99;
  const photo = `https://randomuser.me/api/portraits/women/${photoIndex}.jpg`;
  const interests = chooseInterests();
  const bio = generateBio(interests, state, ageGroup);

  seededUsers.push({
    id: `${Date.now()}${i}`,
    name,
    dob,
    bio,
    email,
    password: passwordHash,
    photo,
    gender: 'Female',
    country: state,
    interests,
    likes: [],
    messages: [],
    emailVerified: true
  });
}

fs.writeFileSync(usersFile, JSON.stringify(seededUsers, null, 2));
console.log('Seeded', seededUsers.length, 'female users to', usersFile);
