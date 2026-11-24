import { defineConfig, devices, type ReporterDescription } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { getBaseUrl } from './config/env'; // safe: only declares functions, reads env lazily

// Real environment variables win over .env.local (loadEnvFile never overrides them).
const localEnvPath = resolve(__dirname, '.env.local');
if (existsSync(localEnvPath)) loadEnvFile(localEnvPath);

const isCI = !!process.env.CI;

const reporter: ReporterDescription[] = [
  ['list'],
  ['html', { open: 'never' }],
  // detail:false keeps only our labelled test.step()s in Allure; Playwright's internal API steps
  // (e.g. `Fill "<value>"`) would otherwise print typed values, including passwords.
  ['allure-playwright', { resultsDir: 'allure-results', detail: false }],
];
if (isCI) {
  reporter.push(['json', { outputFile: 'playwright-summary.json' }]);
} else {
  reporter.push(['./reporters/local-slack.ts']);
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0, // local 0, CI 2
  workers: isCI ? 1 : Number(process.env.WORKERS) || undefined, // CI 1, local configurable
  reporter,
  globalSetup: './allure-setup.ts',
  globalTeardown: isCI || process.env.NO_REPORT_OPEN ? undefined : './allure-teardown.ts',
  use: {
    baseURL: getBaseUrl(),
    testIdAttribute: 'data-testid',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
