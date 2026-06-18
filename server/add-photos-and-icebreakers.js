const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, 'users.json');
const UPLOADS = path.join(__dirname, 'uploads');

if (!fs.existsSync(USERS_FILE)) { console.error('users.json missing'); process.exit(1); }
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));

const icePool = [
  "What's your favorite weekend activity?",
  "If you could travel anywhere tomorrow, where would you go?",
  "What's the best meal you've ever had?",
  "What's a movie you can watch over and over?",
  "What's a song you always have on repeat?",
  "Do you have a pet? Tell me about them!"
];

const bioAdjectives = [
  'curious', 'outgoing', 'thoughtful', 'adventurous', 'creative', 'warm', 'easygoing', 'ambitious', 'fun-loving', 'sincere'
];
const bioActivities = [
  'finding new coffee shops', 'exploring local art', 'planning weekend hikes', 'trying new recipes', 'dancing to live music', 'swapping book recommendations', 'chasing the next road trip', 'photographing city streets', 'hosting friends for game nights', 'collecting vinyl records'
];

function sample(arr, n){ const out = []; const copy = [...arr]; while(out.length < n && copy.length){ out.push(copy.splice(Math.floor(Math.random()*copy.length),1)[0]); } return out; }
function pick(arr, n){ return sample(arr, n); }

function formatBio(user) {
  const interests = (user.interests || []).filter(Boolean);
  const interestText = interests.length > 0 ? interests.slice(0,3).join(', ') : '';
  const adjective = bioAdjectives[Math.floor(Math.random()*bioAdjectives.length)];
  const activity = bioActivities[Math.floor(Math.random()*bioActivities.length)];
  const hometown = user.country ? `from ${user.country}` : 'who loves discovering new places';

  const introTemplates = [
    `I’m a ${adjective} person ${hometown} who loves ${interestText}.`,
    `I’m ${adjective} and ${hometown}, and I enjoy ${interestText}.`,
    `I love ${interestText} and being ${hometown}.`,
    `I’m ${adjective}, ${hometown}, and always up for ${interestText}.`
  ];
  const activityTemplates = [
    `I love ${activity} and always appreciate a great conversation or a spontaneous adventure.`,
    `Nothing beats ${activity} when I’m looking for something fun to do.`,
    `I enjoy ${activity} and believe the best connections start with laughter and curiosity.`,
    `Doing ${activity} is my kind of weekend.`
  ];

  const intro = introTemplates[Math.floor(Math.random()*introTemplates.length)];
  const second = activityTemplates[Math.floor(Math.random()*activityTemplates.length)];

  if (interestText) {
    return `${intro} ${second}`;
  }
  return `I’m a ${adjective} soul ${hometown}, always ready to make new memories. ${second}`;
}

let changed = 0;
for (let u of users){
  const main = u.photo || (u.photos && u.photos[0]) || null;
  if (!main) continue;
  const localPath = main.startsWith('/uploads/') ? path.join(__dirname, main.replace('/uploads/','uploads/')) : null;
  const photos = [];
  if (localPath && fs.existsSync(localPath)){
    // create 2-3 copies
    const total = 2 + Math.floor(Math.random()*2); // 2 or 3
    for (let i=0;i<total;i++){
      const ext = path.extname(localPath) || '.jpg';
      const base = crypto.createHash('sha1').update(u.id + i + Date.now()).digest('hex').slice(0,16);
      const fname = `${base}${ext}`;
      const dest = path.join(UPLOADS, fname);
      if (i===0) {
        // use original as first
        const origName = path.basename(localPath);
        photos.push(`/uploads/${origName}`);
      } else {
        try { fs.copyFileSync(localPath, dest); photos.push(`/uploads/${fname}`); } catch(e){ photos.push(`/uploads/${path.basename(localPath)}`); }
      }
    }
  } else if (u.photo && u.photo.startsWith('http')){
    // fallback: reference same remote photo multiple times
    const total = 2 + Math.floor(Math.random()*2);
    for (let i=0;i<total;i++) photos.push(u.photo);
  }

  if (photos.length) {
    u.photos = photos;
    u.photo = photos[0];
  }

  u.bio = formatBio(u);
  u.icebreakers = pick(icePool, 3);

  changed++;
}

fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
console.log('Updated', changed, 'users with photos, bios and icebreakers');
