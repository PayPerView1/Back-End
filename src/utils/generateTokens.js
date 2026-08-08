// src/utils/generateToken.js
const jwt = require('jsonwebtoken');

const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role: role },
    process.env.JWT_SECRET || 'fallback_secret_key',
    { expiresIn: '30d' } // صلاحية التوكن 30 يوماً
  );
};

module.exports = generateToken;