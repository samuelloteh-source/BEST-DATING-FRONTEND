const bcrypt = require('bcryptjs');
const hash = '$2b$10$xUp54nn5zwgUhvV4efsC7OXMp3VpXe/l2m1VFjlzzgoFJSwYeR9sC';
const candidates = ['password','password123','123456','letmein','qwerty','test123','secret','password1','password!','Test1234!','Passw0rd!','password123!'];
(async () => {
  for (const p of candidates) {
    const ok = await bcrypt.compare(p, hash);
    console.log(p, ok);
  }
})();
