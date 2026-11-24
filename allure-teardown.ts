import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Cross-platform: allure.cmd on Windows, allure on macOS/Linux.
const bin = process.platform === 'win32' ? 'allure.cmd' : 'allure';
const PORT = 5050;

// Stops the report server started by a previous run; otherwise it keeps port 5050 and serves a stale (deleted) report.
function stopPreviousServer(pidFile: string) {
  try {
    const pid = Number(readFileSync(pidFile, 'utf8'));
    if (!pid) return;
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGTERM'); // detached server is its own process group leader
    }
  } catch {
    // no previous server (or it has already exited)
  }
}

export default async function globalTeardown() {
  const root = process.cwd();
  const pidFile = path.join(root, '.runtime', 'allure-server.pid');
  // npm adds node_modules/.bin to PATH only for npm scripts, so use the explicit path (quoted: shell mode).
  const allure = `"${path.join(root, 'node_modules', '.bin', bin)}"`;

  stopPreviousServer(pidFile);

  const result = spawnSync(`${allure} generate allure-results --clean -o allure-report`, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    console.error('Allure report generation failed (is Java installed?)');
    return;
  }

  // Open the report in the browser; the detached server keeps running until the next run stops it.
  const server = spawn(`${allure} open allure-report --port ${PORT}`, {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    shell: true,
  });
  server.unref();
  if (server.pid) {
    mkdirSync(path.dirname(pidFile), { recursive: true });
    writeFileSync(pidFile, String(server.pid));
  }
}
