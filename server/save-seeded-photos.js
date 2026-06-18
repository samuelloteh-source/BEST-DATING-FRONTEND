const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, 'users.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(USERS_FILE)) {
  console.error('users.json not found');
  process.exit(1);
}
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));

async function download(url, dest) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buffer);
    return true;
  } catch (e) {
    console.warn('Failed to download', url, e.message || e);
    return false;
  }
}

(async ()=>{
  let downloaded = 0;
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    if (!u.photo) continue;
    if (u.photo.startsWith('/uploads/')) continue; // already local
    if (!u.photo.startsWith('http')) continue;

    try {
      const url = u.photo;
      const parsed = new URL(url);
      const ext = path.extname(parsed.pathname) || '.jpg';
      const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0,20);
      const filename = `${hash}${ext}`;
      const dest = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(dest)) {
        u.photo = `/uploads/${filename}`;
        continue;
      }
      const ok = await download(url, dest);
      if (ok) {
        u.photo = `/uploads/${filename}`;
        downloaded++;
      }
    } catch (e) {
      console.warn('Error processing user', u.email, e.message || e);
    }
  }

  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  console.log(`Done. Downloaded ${downloaded} images and updated users.json`);
})();
