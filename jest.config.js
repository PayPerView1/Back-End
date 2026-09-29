// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testTimeout: 60000,  // 60 ثانية بدل 5
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};