const db = require('./db.js');

function classify(value) {
  if (!value || typeof value !== 'string' || !value.trim()) return 'empty';
  const v = value.trim();
  if (v.startsWith('data:')) return 'data';
  if (/^https?:\/\//i.test(v)) return 'absolute';
  if (/^\/uploads\//.test(v)) return 'abs-upload';
  if (/^uploads\//.test(v)) return 'rel-upload';
  if (/^blob:/.test(v)) return 'blob';
  return 'other';
}

const counts = { photoUrl: {}, photo: {}, avatar: {} };

db.initDb().then(() => db.loadUsersFromDb()).then((users) => {
  users.forEach((user) => {
    ['photoUrl', 'photo', 'avatar'].forEach((field) => {
      const kind = classify(user[field]);
      counts[field][kind] = (counts[field][kind] || 0) + 1;
    });
  });

  console.log(JSON.stringify(counts, null, 2));

  const emptyUsers = users.filter((user) => (
    classify(user.photoUrl) === 'empty' &&
    classify(user.photo) === 'empty' &&
    classify(user.avatar) === 'empty'
  ));
  console.log(`\nUsers with no image fields: ${emptyUsers.length}`);
  emptyUsers.slice(0, 20).forEach((user) => {
    console.log('-', user.email || user.name || user.id, classify(user.photoUrl), classify(user.photo), classify(user.avatar));
  });

  const uploadUsers = users.filter((user) => (
    ['abs-upload', 'rel-upload'].includes(classify(user.photoUrl)) ||
    ['abs-upload', 'rel-upload'].includes(classify(user.photo)) ||
    ['abs-upload', 'rel-upload'].includes(classify(user.avatar))
  ));
  console.log(`\nUsers with upload paths: ${uploadUsers.length}`);
  uploadUsers.slice(0, 50).forEach((user) => {
    console.log('-', user.email || user.name || user.id, { photoUrl: classify(user.photoUrl), photo: classify(user.photo), avatar: classify(user.avatar) });
  });

  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
