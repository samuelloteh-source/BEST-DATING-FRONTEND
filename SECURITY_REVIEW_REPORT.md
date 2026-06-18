# DATING APP SECURITY & CODE REVIEW - CRITICAL ISSUES FOUND

**Generated:** 2026-06-16  
**Review Scope:** Pre-launch security and functionality assessment  
**Status:** ⚠️ **NOT PRODUCTION READY** - Multiple critical issues found

---

## ⚠️ CRITICAL ISSUES (SHOW-STOPPERS)

### 1. **Hardcoded Admin Credentials in Source Code**
- **Severity:** CRITICAL
- **File:** [server/server.js](server/server.js#L971)
- **Line:** 971
- **Issue:** Admin password `"HaCkMyAsS##@1212"` is hardcoded as a constant visible in the source code
- **Risk:** Anyone with access to the code can become admin and suspend/delete users
- **Impact:** Complete account takeover and data manipulation capability
- **Fix:** 
  - Move to environment variable: `process.env.ADMIN_PASSWORD`
  - Add `.env` to `.gitignore`
  - Require strong password in ENV

### 2. **JWT Secret Hardcoded as String Literal**
- **Severity:** CRITICAL
- **File:** [server/server.js](server/server.js#L137)
- **Line:** 137
- **Issue:** JWT secret is hardcoded as `'your_jwt_secret'`
- **Code:** `jwt.verify(token, 'your_jwt_secret', (err, user) => {`
- **Risk:** Anyone can forge valid JWT tokens
- **Current Status:** JWT appears unused in most endpoints; userId comes from request body
- **Fix:** 
  - Use strong random secret from environment: `process.env.JWT_SECRET`
  - OR remove JWT auth and implement proper session tokens
  - Implement authentication on all protected endpoints

### 3. **Missing Authentication on Critical Endpoints**
- **Severity:** CRITICAL
- **File:** [server/server.js](server/server.js)
- **Vulnerable Endpoints:**
  - [Line 557] `GET /messages/threads?userId=` - No auth required
  - [Line 578] `GET /messages/notifications?userId=` - No auth required
  - [Line 603] `GET /messages/conversation?userId=` - No auth required
  - [Line 713] `POST /typing` - No auth required
  - [Line 746] `GET /typing` - No auth required
  - [Line 753] `PUT /messages/:id` - No auth required
  - [Line 774] `DELETE /messages/:id` - No auth required
- **Risk:** Client-controlled `userId` parameter can be changed to access other users' messages
- **Attack Example:** Attacker can change `userId=123` to `userId=456` to read anyone's conversations
- **Fix:** Implement proper authentication middleware that validates user session/token

### 4. **User ID Trusted from Client Request Body**
- **Severity:** CRITICAL
- **File:** [server/server.js](server/server.js)
- **Affected Endpoints:**
  - [Line 421] `POST /like` - `const { userId, targetId } = req.body;`
  - [Line 813] `POST /messages` - `let { from, to, text } = req.body;`
  - [Line 677] `POST /edit-profile` - `const { userId, name, dob, ... } = req.body;`
  - [Line 725] `POST /profile/gallery` - `const userId = req.body.userId;`
  - [Line 740] `DELETE /profile/gallery/:id` - `const userId = req.query.userId;`
  - [Line 761] `DELETE /delete-account` - `const userId = req.body.userId || req.query.userId;`
- **Risk:** User A can impersonate User B and perform actions as them
- **Attack Example:** 
  ```
  POST /like { userId: "123", targetId: "456" }  // User 123 is someone else's ID
  POST /messages { from: "999", to: "111", text: "..." }  // Spoof message from anyone
  DELETE /delete-account { userId: "456" }  // Delete anyone's account
  ```
- **Fix:** Extract `userId` from authenticated session token, not from request body

### 5. **Admin Panel Exposes Password in HTML**
- **Severity:** CRITICAL
- **File:** [server/server.js](server/server.js#L1089)
- **Line:** 1089 (in admin page JavaScript)
- **Issue:** When admin enters password, it's embedded in JavaScript: `const pwd = ${JSON.stringify(password)};`
- **Risk:** Password visible in browser DevTools and page source
- **Fix:** Use secure session/cookie instead of passing password in HTML

### 6. **Missing Suspension Enforcement on Sensitive Endpoints**
- **Severity:** CRITICAL (Compliance Issue)
- **File:** [server/server.js](server/server.js)
- **Suspended User Can Still:**
  - [Line 557] Load message threads with `GET /messages/threads`
  - [Line 603] Read conversations with `GET /messages/conversation`
  - [Line 715] Access gallery with `GET /profile/gallery`
  - [Line 813] Send messages with `POST /messages` ✓ (has check)
  - [Line 713] Change typing status with `POST /typing` (no check)
  - [Line 753] Edit messages with `PUT /messages/:id` (no check)
  - [Line 774] Delete messages with `DELETE /messages/:id` (no check)
- **Correct Implementations:**
  - [Line 421] `POST /like` - ✓ Checks `user.suspended`
  - [Line 813] `POST /messages` - ✓ Checks both users' suspension status
  - [Line 856] `POST /typing` - ✓ Has suspension check
- **Fix:** Add suspension checks to all endpoints that allow user actions:
  ```javascript
  if (user.suspended) {
    return res.status(403).json({ error: 'Account suspended' });
  }
  ```

### 7. **Unauthenticated Access to All Users List**
- **Severity:** CRITICAL
- **File:** [server/server.js](server/server.js#L466)
- **Line:** 466
- **Issue:** `GET /users` endpoint has no authentication
- **Code:** `app.get('/users', (req, res) => {`
- **Exposure:** Anyone can download all user profiles including:
  - All names, emails, locations, bios
  - Phone numbers (if added)
  - Photos and galleries
  - Interest lists and preferences
  - Likes/matches data
  - Message counts
- **Risk:** Mass user data scraping, spam, harassment, privacy violation
- **Fix:** Require authentication and only return filtered matches for logged-in user

### 8. **Account Deletion Not Verified by Password**
- **Severity:** CRITICAL
- **File:** [server/server.js](server/server.js#L761)
- **Line:** 761-810
- **Issue:** `DELETE /delete-account` only checks `userId` parameter (from client)
- **Code:** `const userId = req.body.userId || req.query.userId;`
- **Risk:** CSRF attack - attacker can delete victim's account by changing userId
- **Attack:** `fetch('/delete-account', {method:'DELETE', body:JSON.stringify({userId:'456'})})`
- **Fix:** Require password confirmation and use authenticated session, not userId parameter

---

## 🔴 HIGH SEVERITY ISSUES

### 9. **No Input Validation on Message Content**
- **Severity:** HIGH
- **File:** [server/server.js](server/server.js#L813)
- **Line:** 813-865
- **Issue:** Message text only has basic sanitization of `<script>` tags
- **Code:** `text = sanitizeString(text);` (only removes `<script>` tags)
- **Risk:** 
  - HTML/CSS injection possible (e.g., `<img onerror="alert()">`)
  - XSS attacks through message content
  - Code execution if messages are rendered unsafely
- **Sanitization Gap:** Function at [Line 35](server/server.js#L35) only removes `<script>` tags:
  ```javascript
  return str.replace(/<\/?script[^>]*>/gi, '').trim();
  ```
- **Missing:** 
  - HTML entity encoding
  - Content length limits
  - Profanity/spam filters
- **Fix:** Use proper HTML escaping library or whitelist safe tags only

### 10. **Race Condition: Duplicate Likes**
- **Severity:** HIGH
- **File:** [server/server.js](server/server.js#L421)
- **Line:** 421-465
- **Issue:** `/like` endpoint allows sending duplicate likes
- **Code:** 
  ```javascript
  if (!user.likes.includes(targetId)) {
    user.likes.push(targetId);
  }
  ```
- **Race Condition:** Two simultaneous requests can both see `likes.includes(targetId)` as false
- **Impact:** Database inconsistency, incorrect match counts, duplicate notifications
- **Fix:** Use atomic operations or database locks, or validate on server before update

### 11. **CORS Configuration Allows All Origins for Socket.io**
- **Severity:** HIGH
- **File:** [server/server.js](server/server.js#L1065)
- **Line:** 1065
- **Issue:** Socket.io CORS allows all origins: `cors: { origin: '*' }`
- **Risk:** Any website can connect to your Socket.io server
- **Attack:** Cross-site hijacking, message sniffing, real-time data manipulation
- **Fix:** 
  ```javascript
  cors: { 
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true 
  }
  ```

### 12. **Socket.io User Room Access Not Validated**
- **Severity:** HIGH
- **File:** [server/server.js](server/server.js#L1069)
- **Lines:** 1069-1078
- **Issue:** Any connected client can join any user's room
- **Code:**
  ```javascript
  socket.on('join', (userId) => {
    if (userId) socket.join(userId);  // No validation!
  });
  ```
- **Risk:** User A can join User B's socket room and intercept real-time messages
- **Attack Example:** `socket.emit('join', '999');` // Join another user's room
- **Fix:** Validate that joining user is authenticated and is joining their own room

### 13. **Missing CSRF Protection**
- **Severity:** HIGH
- **File:** [server/server.js](server/server.js)
- **Issue:** No CSRF token validation on state-changing endpoints (POST, PUT, DELETE)
- **Examples:**
  - POST /like, POST /messages, POST /signup
  - DELETE /delete-account, DELETE /profile/gallery/:id
- **Risk:** Attacker can trick logged-in user into performing unwanted actions
- **Attack:** `<img src="https://yoursite.com/like?userId=123&targetId=456">`
- **Fix:** Implement CSRF tokens (double-submit cookie or synchronizer token pattern)

### 14. **No HTTPS Enforcement or Security Headers**
- **Severity:** HIGH
- **File:** [server/server.js](server/server.js#L100)
- **Issue:** No HTTPS redirect, no HSTS header, no CSP headers
- **Missing:**
  - `app.use(helmet())` - Missing security headers
  - No redirect to HTTPS
  - No X-Frame-Options (clickjacking)
  - No Content-Security-Policy
  - No X-Content-Type-Options
- **Risk:** Man-in-the-middle attacks, data interception, clickjacking
- **Fix:** Add helmet middleware and HTTPS redirect

### 15. **Email Not Properly Verified Before Use**
- **Severity:** HIGH
- **File:** [server/server.js](server/server.js#L200)
- **Line:** 200-290
- **Issue:** Email verification token not required before login
- **Verification Status:** `emailVerified` field exists but:
  - Token stored but can be removed after verification
  - No rate limiting on `/verify-email`
  - Token never expires
- **Fix:**
  - Add token expiration: `user.emailVerificationExpires = Date.now() + 24*3600*1000`
  - Enforce email verified before allowing profile visibility to others
  - Rate limit email verification attempts

### 16. **No Password Reset Token Expiration Check**
- **Severity:** HIGH
- **File:** [server/server.js](server/server.js#L658)
- **Line:** 658-675
- **Good:** Token has expiration: `user.passwordResetExpires = Date.now() + 3600 * 1000`
- **Issue:** Check happens at: `Date.now() < u.passwordResetExpires`
- **Problem:** Tokens could be stored indefinitely if expiry field corrupted
- **Fix:** Add additional validation for token age

### 17. **Insecure File Upload Path Disclosure**
- **Severity:** HIGH  
- **File:** [server/server.js](server/server.js#L14)
- **Lines:** 14-22, 725, 813
- **Issue:** File paths are predictable and disclosed to client
- **Code:** `photo = req.file ? `/uploads/${req.file.filename}` : '';`
- **Problems:**
  - Filename not randomized (uses multer's default)
  - Client knows exact storage path
  - No file type validation beyond MIME type
  - Uploaded files directly served without sanitization
- **Attack:** Directory traversal, malicious file uploads, path manipulation
- **Fix:**
  ```javascript
  const safeFilename = crypto.randomBytes(16).toString('hex') + path.extname(file.originalname);
  photo = `/uploads/${safeFilename}`;
  ```

### 18. **localStorage Used for Sensitive Data Without Encryption**
- **Severity:** HIGH
- **File:** [client/profile.html](client/profile.html#L71), [client/discover.html](client/discover.html#L62), etc.
- **Issue:** Full user object stored in plain text localStorage
- **Code:** `localStorage.setItem('user', JSON.stringify(data.user));`
- **Exposure:** Includes:
  - User ID (for impersonation)
  - Email address
  - DOB (identity theft)
  - Gender, location, interests (profiling)
- **Risk:** XSS attacks can steal all user data, browser extensions can read, physical access
- **Fix:**
  - Store only session token in localStorage
  - Keep user data in memory (React state/Vue data)
  - OR encrypt localStorage data with encryption library
  - Use httpOnly cookies for tokens (can't be accessed by JS)

### 19. **Potential XSS in User Profile Display**
- **Severity:** HIGH
- **File:** [client/discover.html](client/discover.html#L119)
- **Line:** 119-143
- **Issue:** User bio rendered without HTML escaping in some places
- **Good:** Uses `escapeHtml()` function at [line 129](client/discover.html#L129)
- **Problem:** Function defined locally, not consistently applied everywhere
- **Example at line 119-143:** 
  ```javascript
  <h2>${user.name}</h2>  // Not escaped
  <p class="hint">Tap the card to view full profile</p>
  ```
- **Better:** Name should be escaped: `${escapeHtml(user.name)}`
- **Also missing on:** profile-detail.html photo carousel

### 20. **No Rate Limiting on Login Attempts**
- **Severity:** HIGH
- **File:** [server/server.js](server/server.js#L292)
- **Line:** 292-350
- **Issue:** No rate limiting on `/login` endpoint
- **Risk:** Brute force attacks on passwords
- **Contrast:** `/resend-verification` [has rate limiting](server/server.js#L390-397)
- **Fix:** Apply same rate limiting to login:
  ```javascript
  // max 5 attempts per email per hour
  requestRate[email] = requestRate[email] || [];
  requestRate[email] = requestRate[email].filter(ts => now - ts < 3600 * 1000);
  if (requestRate[email].length >= 5) {
    return res.status(429).json({ error: 'Too many attempts' });
  }
  ```

---

## 🟠 MEDIUM SEVERITY ISSUES

### 21. **Uninitialized Variables Could Crash Pages**
- **Severity:** MEDIUM
- **File:** Multiple client files
- **Examples:**
  - [profile.html Line 71](client/profile.html#L71): `const user = JSON.parse(localStorage.getItem('user'));` - Could be null
  - [discover.html Line 62](client/discover.html#L62): Direct access to `currentUser.id` without null check
  - [profile-detail.html Line ~80](client/profile-detail.html#L80): `profile` object accessed before loaded
- **Risk:** JavaScript errors crash page, poor user experience
- **Example Crash:**
  ```javascript
  const user = JSON.parse(localStorage.getItem('user'));
  document.getElementById('name').innerText = user.name;  // Crashes if user is null
  ```
- **Fix:**
  ```javascript
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) {
    window.location.href = '/login.html';
    throw new Error('User not authenticated');
  }
  ```

### 22. **Missing Error Handling on Fetch Calls**
- **Severity:** MEDIUM
- **File:** [client/app.js](client/app.js#L16)
- **Lines:** Multiple
- **Issue:** Some fetch calls in app.js don't check `res.ok` or handle network errors
- **Example at Line 16-29:**
  ```javascript
  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, dob, bio, email, password })
  });
  const data = await res.json();  // No check for res.ok
  ```
- **Risk:** 
  - Server errors shown as successful
  - Crash on non-JSON response
  - User confusion with bad error messages
- **Better:** See [session-handler.js](client/session-handler.js#L1) for good pattern
- **Fix:** Always check `res.ok` before parsing JSON

### 23. **Race Condition: Concurrent Message Sends**
- **Severity:** MEDIUM
- **File:** [client/messages.html](client/messages.html) (read partially, inferred from code)
- **Issue:** Multiple simultaneous message submissions not prevented
- **Code:** No submit button disable during fetch
- **Risk:** Duplicate messages sent, confused UI state
- **Fix:** Disable send button during submission:
  ```javascript
  const sendBtn = document.querySelector('.send-btn');
  sendBtn.disabled = true;
  try {
    await fetch('/messages', ...);
  } finally {
    sendBtn.disabled = false;
  }
  ```

### 24. **No API Response Validation Before Use**
- **Severity:** MEDIUM
- **File:** [client/discover.html](client/discover.html#L75)
- **Line:** 75-88
- **Issue:** API response not validated for expected structure
- **Code:**
  ```javascript
  allUsers = await res.json();
  allUsers = allUsers.filter(u => u.id !== currentUser.id);  // Assumes array
  ```
- **Risk:** If server returns `{success: true, users: [...]}`, this breaks
- **Better:** Add schema validation or type checking
- **Fix:**
  ```javascript
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('Invalid users response');
  }
  allUsers = data;
  ```

### 25. **Inconsistent Error Messages Leak Information**
- **Severity:** MEDIUM
- **File:** [server/server.js](server/server.js#L245)
- **Line:** 245, 313, 399
- **Issue:** Different error messages for signup vs login
- **Signup (Line 245):** `"Email already exists"` - confirms email is registered
- **Login (Line 313):** `"No account found"` - same info disclosed
- **Risk:** User enumeration attack
- **Attacker Can:** Build list of valid emails by checking signup/login errors
- **Fix:** Use generic message for both:
  ```javascript
  "Account not found or password incorrect"
  ```

### 26. **MX Record Lookup Can Fail Silently**
- **Severity:** MEDIUM
- **File:** [server/server.js](server/server.js#L231)
- **Lines:** 231-240
- **Code:**
  ```javascript
  try {
    const domain = email.split('@')[1];
    const mx = await dns.resolveMx(domain);
    if (!mx || mx.length === 0) {
      return res.status(400).json({ message: 'Email domain does not appear to accept mail.' });
    }
  } catch (e) {
    console.warn('MX lookup failed', ...);
    // continue — don't block signup solely on MX lookup failure
  }
  ```
- **Issue:** MX lookup can fail for valid domains (network issues, timeouts)
- **Risk:** Valid users blocked from signing up
- **Fix:** 
  - Make MX check optional/warning only
  - Use exponential backoff retry
  - Log failures for monitoring

### 27. **No Typing Status Cleanup on Disconnect**
- **Severity:** MEDIUM
- **File:** [server/server.js](server/server.js#L1069)
- **Issue:** Socket.io doesn't clean up typing status on disconnect
- **Code:** `typingStatus` is an in-memory object that grows indefinitely
- **Risk:** Memory leak, stale typing indicators
- **Fix:**
  ```javascript
  io.on('connection', (socket) => {
    socket.on('disconnect', () => {
      // Clean up typing status for this socket
      Object.keys(typingStatus).forEach(key => {
        if (key.includes(userId)) delete typingStatus[key];
      });
    });
  });
  ```

### 28. **Duplicate Code in User Loading**
- **Severity:** MEDIUM (Code Quality)
- **File:** [server/server.js](server/server.js)
- **Issue:** `loadUsersFromFile()` and `saveUsersToFile()` repeated 20+ times
- **Lines:** 194-199, 427, 521, etc.
- **Risk:** 
  - Maintenance burden
  - File corruption if one save fails
  - Inconsistent error handling
- **Fix:** Abstract into UserService class or module

### 29. **Socket.io Not Used Consistently**
- **Severity:** MEDIUM
- **File:** [server/server.js](server/server.js#L858-862, 903-907, 950-954)
- **Lines:** 858, 903, 950
- **Issue:** Socket.io events wrapped in try-catch but not reliable
- **Code:**
  ```javascript
  try { io && io.to(to).emit('message', message); } catch (e) {}
  try { io && io.to(from).emit('message', message); } catch (e) {}
  ```
- **Risk:** 
  - Silent failures
  - Real-time features unreliable
  - Polling fallback not clear
- **Fix:** 
  - Use proper event handlers
  - Log socket errors
  - Implement polling fallback explicitly

### 30. **No Sensitive Field Masking in Admin Panel**
- **Severity:** MEDIUM
- **File:** [server/server.js](server/server.js#L1072)
- **Line:** 1072
- **Issue:** Admin table displays user passwords as blank but shows other sensitive data
- **Exposure:** Email addresses, dates of birth visible in admin panel
- **Risk:** Compromised admin account exposes all users
- **Fix:** 
  - Require additional auth for sensitive fields
  - Implement proper audit logging
  - Add field-level encryption

---

## 🟡 LOW SEVERITY ISSUES

### 31. **Dead Code: MongoDB References**
- **Severity:** LOW
- **File:** [server/server.js](server/server.js#L1152-1169)
- **Lines:** 1152-1169
- **Issue:** 
  ```javascript
  app.put('/api/messages/:id', async (req, res) => {
    try {
      const msg = await Message.findById(req.params.id);  // Message is undefined
  ```
- **Note:** Code uses `users.json` file storage, not MongoDB
- **Risk:** Confusion, potential future bugs if activated
- **Fix:** Remove unused database code

### 32. **Incomplete Socket.io Implementation**
- **Severity:** LOW
- **File:** [client/discover.html](client/discover.html#L249)
- **Lines:** 249-267
- **Issue:** Socket.io loaded but connection error not handled
- **Code:**
  ```javascript
  script.onload = () => {
    try {
      window.socket = io();  // Could fail
    } catch (e) {
      console.warn('Socket.io init failed', e);  // Only warns
    }
  };
  ```
- **Risk:** Fallback to polling not documented or tested
- **Fix:** Add explicit polling fallback and error handling

### 33. **Unused Dependencies in package.json**
- **Severity:** LOW
- **File:** [server/package.json](server/package.json)
- **Line:** 
- **Issue:** 
  - `socket.io` listed but errors are silently caught
  - No `helmet` for security headers
  - No `cors` package (using inline CORS)
  - No `.env` for environment variables
- **Fix:** 
  - Add: `npm install helmet dotenv`
  - Remove: unused packages
  - Update `.gitignore` for `.env`

### 34. **Console.log Statements Log Sensitive Data**
- **Severity:** LOW
- **File:** [server/server.js](server/server.js#L221-223)
- **Lines:** 221-223, 328
- **Issue:**
  ```javascript
  console.log('Signup request:', { email, name, dob, bio, country, hasPassword: !!password });
  console.log('Signup body:', req.body);  // Logs everything including password?
  console.log('Signup file:', req.file);
  ```
- **Risk:** 
  - Production logs expose user data
  - Server logs accessible to system admins
  - Password could be logged
- **Fix:** 
  - Remove console.logs from production
  - Use logger with redaction filters
  - Never log passwords or tokens

### 35. **Missing Environment Configuration**
- **Severity:** LOW  
- **File:** Entire project
- **Issue:** No `.env` file support
- **Hard-coded values:**
  - `PORT = 3000` (line 24)
  - `USERS_FILE` path (line 10)
  - `MESSAGES_FILE` path (line 188)
  - `SMTP_*` from environment but no defaults documented
  - CORS whitelist includes `https://yourdomain.com` (placeholder)
- **Fix:** Add `dotenv` package and `.env.example`:
  ```
  PORT=3000
  ADMIN_PASSWORD=<random string>
  JWT_SECRET=<random string>
  SMTP_HOST=...
  ```

### 36. **Inconsistent File Path Handling**
- **Severity:** LOW
- **File:** [server/server.js](server/server.js)
- **Issues:**
  - `USERS_FILE = path.join(__dirname, 'users.json')` but later accessed as `'users.json'`
  - `MESSAGES_FILE` paths inconsistent
  - Upload paths use relative `'uploads/'` and absolute paths mixed
- **Risk:** File not found errors, path traversal attacks
- **Fix:** Always use absolute paths from `__dirname`

### 37. **Missing Input Length Limits**
- **Severity:** LOW
- **File:** [server/server.js](server/server.js#L200)
- **Issue:** 
  - Bio field has no maximum length (could be 10MB)
  - Name field unbounded
  - Email unbounded
- **Risk:** 
  - Storage exhaustion attacks
  - Database bloat
  - UI display issues
- **Fix:** Add length validation:
  ```javascript
  if (bio?.length > 1000) {
    return res.status(400).json({ error: 'Bio too long' });
  }
  ```

### 38. **Missing Content-Type Validation**
- **Severity:** LOW
- **File:** [server/server.js](server/server.js#L813)
- **Line:** 813-865
- **Issue:** Message endpoint accepts `Content-Type: application/json` but photo upload too
- **Code:** 
  ```javascript
  app.post('/messages', upload.single('photo'), (req, res) => {
    let { from, to, text } = req.body;
  ```
- **Risk:** Content smuggling, unclear expected format
- **Fix:** Document API contract clearly, validate Content-Type

### 39. **No API Documentation**
- **Severity:** LOW
- **File:** None
- **Issue:** No README.md, API documentation, or error codes defined
- **Risk:** 
  - Developers waste time figuring out endpoints
  - Inconsistent error handling
  - Security assumptions unclear
- **Fix:** Create `API.md` with:
  ```markdown
  # API Endpoints
  
  ## POST /signup
  - Auth: None (public)
  - Body: { name, email, password, dob, ... }
  - Response: { success, user, message }
  - Errors: 400 (validation), 409 (email exists), 500 (server)
  ```

### 40. **No Backup/Recovery Strategy**
- **Severity:** LOW
- **File:** [server/server.js](server/server.js#L195-199)
- **Issue:** 
  - User data stored in `users.json` (single file)
  - No backups documented
  - File corruption could lose all data
  - No write verification
- **Risk:** Total data loss from single disk failure
- **Fix:**
  - Implement periodic backups
  - Use proper database (SQLite already imported!)
  - Add database integrity checks

---

## 📊 DATA CONSISTENCY ISSUES

### 41. **Mixed SQLite and File Storage**
- **Severity:** MEDIUM
- **File:** [server/server.js](server/server.js#L93)
- **Line:** 93-97, 292-350
- **Issue:** 
  ```javascript
  const db = new sqlite3.Database('./users.db');
  db.run(`CREATE TABLE IF NOT EXISTS users ...`);
  // BUT all user operations use JSON file:
  const users = loadUsersFromFile();  // users.json
  ```
- **Problem:** SQLite database created but never used!
- **Risk:**
  - Users added to JSON but not database
  - Login tries database first, then falls back to JSON
  - Data inconsistency
- **Fix:** Either:
  - Use SQLite exclusively (better for production)
  - Delete SQLite code if keeping JSON storage
  - Document which storage is authoritative

### 42. **Inconsistent Message Storage**
- **Severity:** MEDIUM
- **File:** [server/server.js](server/server.js#L813-865, 188-192)
- **Issue:**
  - Messages stored in `user.messages` array
  - Also saved to `messages.json` (central store)
  - No synchronization between them
- **Code:**
  ```javascript
  sender.messages.push(message);  // Store in user
  recipient.messages.push(message);
  saveUsersToFile(users);
  // THEN separate central store:
  try { io && io.to(to).emit('message', message); } catch (e) {}
  ```
- **Risk:** 
  - `messages.json` not updated on `/messages` POST
  - Central messages.json is stale
  - Data duplication
- **Fix:** 
  - Pick ONE storage method
  - OR sync them with transactions

### 43. **Missing Orphaned Data Cleanup**
- **Severity:** MEDIUM
- **File:** [server/server.js](server/server.js#L533-556)
- **Issue:** When user deleted, cleanup is incomplete:
  ```javascript
  users.forEach(u => {
    if (Array.isArray(u.likes)) u.likes = u.likes.filter(id => String(id) !== String(userId));
    if (Array.isArray(u.messages)) u.messages = u.messages.filter(m => ...);
    if (Array.isArray(u.matches)) u.matches = u.matches.filter(id => ...);
  });
  ```
- **Missing Cleanups:**
  - Email verification tokens
  - Password reset tokens
  - Photos in `/uploads/` folder (partially cleaned at line 548)
  - Central `messages.json` (partially cleaned at line 783)
  - Typing status in memory
- **Risk:** 
  - Reuse of deleted email creates orphaned records
  - Stale tokens reactivate accounts
  - Disk usage grows indefinitely
- **Fix:** Create comprehensive cleanup function called on user delete

### 44. **Null/Undefined Field Inconsistencies**
- **Severity:** LOW
- **File:** [server/users.json](server/users.json) (seen in read)
- **Example from sample data:**
  - Some users have `photos: []`, others don't have field
  - Some have `icebreakers: []`, others missing
  - `emailVerified: true` vs not present
- **Risk:** Crashes when accessing fields expecting them to exist
- **Fix:** Initialize all users with same schema:
  ```javascript
  const defaultUser = {
    id: '',
    email: '',
    password: '',
    // ... all fields with defaults
    photos: [],
    icebreakers: [],
    emailVerified: false,
  };
  ```

---

## 🔒 SUMMARY TABLE

| # | Category | Severity | File | Line | Issue | 
|---|----------|----------|------|------|-------|
| 1 | Secrets | CRITICAL | server.js | 971 | Hardcoded admin password |
| 2 | Secrets | CRITICAL | server.js | 137 | Hardcoded JWT secret |
| 3 | Auth | CRITICAL | server.js | 557+ | Missing auth on message endpoints |
| 4 | Auth | CRITICAL | server.js | 421+ | UserId from client request |
| 5 | Auth | CRITICAL | server.js | 1089 | Admin password in HTML |
| 6 | Auth | CRITICAL | server.js | 557+ | Missing suspension checks |
| 7 | Auth | CRITICAL | server.js | 466 | Unauthenticated /users endpoint |
| 8 | Auth | CRITICAL | server.js | 761 | Account deletion not verified |
| 9 | Input | HIGH | server.js | 813 | Weak message sanitization |
| 10 | Logic | HIGH | server.js | 421 | Race condition in /like |
| 11 | Infra | HIGH | server.js | 1065 | CORS allows all origins |
| 12 | Infra | HIGH | server.js | 1069 | Socket.io no user validation |
| 13 | Infra | HIGH | server.js | N/A | No CSRF protection |
| 14 | Infra | HIGH | server.js | N/A | No HTTPS/security headers |
| 15 | Auth | HIGH | server.js | 200 | Email verification not enforced |
| 16 | Auth | HIGH | server.js | 658 | Weak reset token validation |
| 17 | Files | HIGH | server.js | 14 | Predictable file paths |
| 18 | Client | HIGH | client/* | 71 | Sensitive data in localStorage |
| 19 | Client | HIGH | client/discover.html | 119 | Potential XSS in display |
| 20 | Auth | HIGH | server.js | 292 | No login rate limiting |
| ... | ... | MEDIUM | ... | ... | See above |
| ... | ... | LOW | ... | ... | See above |

---

## 🛠️ IMMEDIATE ACTION ITEMS (Priority Order)

### Before ANY production deployment:

1. **MANDATORY - TODAY:**
   - [ ] Move `ADMIN_PASSWORD` to `.env` file
   - [ ] Move `JWT_SECRET` to `.env` file
   - [ ] Add authentication to `/messages/*` endpoints
   - [ ] Stop trusting `userId` from request body
   - [ ] Add password to `/delete-account` validation
   - [ ] Remove admin password from HTML page

2. **MANDATORY - THIS WEEK:**
   - [ ] Add rate limiting to `/login` endpoint
   - [ ] Fix Socket.io CORS configuration
   - [ ] Add CSRF protection to all forms
   - [ ] Implement proper HTML escaping everywhere
   - [ ] Add HTTPS and security headers (helmet)
   - [ ] Fix suspension checks on all endpoints

3. **MUST FIX - BEFORE LAUNCH:**
   - [ ] Implement proper session authentication
   - [ ] Choose database (SQLite or file) and use consistently
   - [ ] Add input validation and length limits
   - [ ] Implement comprehensive error handling
   - [ ] Add proper logging and monitoring
   - [ ] Create API documentation
   - [ ] Implement backup/recovery plan

4. **SHOULD FIX - BEFORE LAUNCH:**
   - [ ] Encrypt localStorage or use httpOnly cookies
   - [ ] Implement email verification enforcement
   - [ ] Add content moderation/spam filtering
   - [ ] Implement rate limiting on all endpoints
   - [ ] Add monitoring and alerting
   - [ ] Security testing/penetration testing

---

## 📝 REMEDIATION CHECKLIST

- [ ] All hardcoded credentials removed
- [ ] All endpoints have proper authentication
- [ ] All endpoints check user.suspended status
- [ ] All user inputs validated and sanitized
- [ ] HTTPS enforced with redirect
- [ ] Security headers added (helmet)
- [ ] CSRF protection implemented
- [ ] Rate limiting on sensitive endpoints
- [ ] Email verification enforced before full access
- [ ] Proper session/token handling
- [ ] Error messages don't leak information
- [ ] Sensitive data not in logs
- [ ] No sensitive data in localStorage
- [ ] Database usage consistent (not mixed)
- [ ] File uploads validated and secured
- [ ] Socket.io properly authenticated
- [ ] Audit logging for sensitive actions
- [ ] Backup and recovery tested
- [ ] Security headers tested
- [ ] Error handling tested for all endpoints
- [ ] Rate limiting tested
- [ ] Data consistency verified
- [ ] Code reviewed for XSS/injection
- [ ] Dependencies updated (npm audit)
- [ ] Load testing done
- [ ] Pen testing completed

---

## 🚨 CRITICAL NEXT STEPS

**DO NOT LAUNCH WITHOUT:**
1. Fixing authentication on message endpoints (CRITICAL)
2. Removing hardcoded credentials (CRITICAL)
3. Stopping reliance on client-provided userId (CRITICAL)
4. Adding email verification enforcement (CRITICAL)
5. Implementing proper session management (CRITICAL)

**ESTIMATED EFFORT:** 40-60 hours to fix all critical and high issues

**RISK LEVEL:** 🔴 **CRITICAL** - Not ready for any production exposure with real users
