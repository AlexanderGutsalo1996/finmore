import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

// Cross-platform: allure.cmd on Windows, allure on macOS/Linux.
const bin = process.platform === 'win32' ? 'allure.cmd' : 'allure';

export default async function globalTeardown() {
  const root = process.cwd();
  // npm adds node_modules/.bin to PATH only for npm scripts, so use the explicit path (quoted: shell mode).
  const allure = `"${path.join(root, 'node_modules', '.bin', bin)}"`;

  const result = spawnSync(`${allure} generate allure-results --clean -o allure-report`, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    console.error('Allure report generation failed (is Java installed?)');
    return;
  }

  // Open the report in the browser; the detached server may keep running after the test run.
  spawn(`${allure} open allure-report --port 5050`, {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    shell: true,
  }).unref();
}
