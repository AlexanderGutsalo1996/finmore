// Runs Playwright in Evidence Mode (full evidence for every test): npm run test:evidence -- tests/login.spec.ts
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const cli = resolve(__dirname, '../node_modules/@playwright/test/cli.js');
const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [cli, 'test', ...args], {
  stdio: 'inherit',
  env: { ...process.env, EVIDENCE_MODE: '1' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
