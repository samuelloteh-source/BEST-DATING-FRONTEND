const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id: { type: String },
  name: String,
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: String,
  photoUrl: String,
  createdAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
