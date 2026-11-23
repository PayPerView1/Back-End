// src/utils/generateTokens.js
const jwt = require('jsonwebtoken');

const generateToken = (userId, role, tokenVersion = 0) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
  }

  return jwt.sign(
    { id: userId, role, ver: tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: '30d' } // صلاحية التوكن 30 يوماً
  );
};

module.exports = generateToken;
