import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCI } from '../config/env';
import { Logger } from '../config/Logger';
import type { RegistrationData } from '../Data/generators';

const logger = new Logger('userStore');
const USERS_DIR = join(process.cwd(), '.runtime', 'users');

// On locally by default, off in CI; STORE_GENERATED_USERS=0/1 overrides the local default.
const isEnabled = () => !isCI() && process.env.STORE_GENERATED_USERS !== '0';

/**
 * Saves a generated throw-away user to `.runtime/users/<id>.json` (one file per user: no shared file,
 * so no race between workers). The directory is git-ignored and never uploaded or logged.
 * Tests do not read it: it exists for manual debugging, re-login and later cleanup tooling.
 */
export function saveGeneratedUser(user: RegistrationData): void {
  if (!isEnabled()) return;
  try {
    mkdirSync(USERS_DIR, { recursive: true });
    const file = join(USERS_DIR, `${randomUUID()}.json`);
    writeFileSync(file, JSON.stringify({ ...user, savedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  } catch {
    logger.warn('Could not store the generated user (non-fatal).'); // never log the user data
  }
}
