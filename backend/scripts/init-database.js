const { spawnSync } = require('node:child_process');
const path = require('node:path');

const result = spawnSync('npm', ['run', 'db:init'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: process.platform === 'win32'
});
process.exitCode = result.status ?? 1;
