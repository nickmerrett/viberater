// Set env defaults for local dev — pipeline sets these via shell env
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-ci-min-32-chars!!';
process.env.DB_TYPE = process.env.DB_TYPE || 'sqlite';
process.env.SQLITE_DIR = process.env.SQLITE_DIR || '/tmp';

module.exports = {
  testEnvironment: 'node',
  transform: {},
  globalSetup: './__tests__/globalSetup.cjs',
  testTimeout: 30000,
  maxWorkers: 1,
  testMatch: ['**/__tests__/**/*.test.js'],
};
