const { execSync } = require('child_process');
const path = require('path');

module.exports = async function () {
  execSync('node migrations/run.js', {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      DB_TYPE: 'sqlite',
      SQLITE_DIR: process.env.SQLITE_DIR || '/tmp',
      NODE_ENV: 'test',
      JWT_SECRET: process.env.JWT_SECRET || 'test-secret-key-for-ci-min-32-chars!!',
    },
    stdio: 'inherit',
  });
};
