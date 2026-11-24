const { readFileSync } = require('node:fs');

// Slack mrkdwn: only & < > must be escaped.
const escapeSlack = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const MAX_LISTED = 15;
const DEFAULT_BASE_URL = 'https://finmore.netlify.app'; // keep in sync with config/env.ts

function collectIssues(report) {
  const failed = [];
  const flaky = [];
  function visit(suite, parents) {
    // Skip the file-level suite title (it is the spec file name), keep describe titles.
    const titles = suite.file && suite.title === suite.file ? parents : [...parents, suite.title];
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        if (!['unexpected', 'flaky'].includes(test.status)) continue;
        // Titles are static and credential-free by project rule; errors are never included.
        const title = [...titles, spec.title].filter(Boolean).join(' › ');
        const entry = `${escapeSlack(title)} — ${escapeSlack(spec.file || suite.file || 'unknown')}:${spec.line || '?'}`;
        (test.status === 'flaky' ? flaky : failed).push(entry);
      }
    }
    for (const child of suite.suites || []) visit(child, titles);
  }
  for (const suite of report.suites || []) visit(suite, []);
  return { failed, flaky };
}

function listSection(header, icon, items) {
  if (!items.length) return [];
  const lines = [header, ...items.slice(0, MAX_LISTED).map((item) => `${icon} ${item}`)];
  if (items.length > MAX_LISTED) lines.push(`…and ${items.length - MAX_LISTED} more in the report.`);
  return lines;
}

function buildMessage(report, env) {
  const stats = report?.stats;
  const flakyCount = stats?.flaky || 0;
  const passed = env.JOB_STATUS === 'success' && !!stats; // a missing report is never "passed"
  const status = !passed ? '❌ Failed' : flakyCount > 0 ? '⚠️ Passed with flaky tests' : '✅ Passed';

  const branch = env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || 'unknown';
  const lines = [
    `*FinMore UI Tests — ${status}*`,
    `Repository: ${escapeSlack(env.GITHUB_REPOSITORY || 'unknown')} | Branch: ${escapeSlack(branch)}`,
    `Trigger: ${escapeSlack(env.GITHUB_EVENT_NAME || 'unknown')} | Run #${escapeSlack(env.GITHUB_RUN_NUMBER || '?')}`,
    `Environment: ${escapeSlack(env.BASE_URL || DEFAULT_BASE_URL)}`,
  ];

  if (stats) {
    const { expected = 0, unexpected = 0, flaky = 0, skipped = 0, duration = 0 } = stats;
    lines.push(
      `*Total:* ${expected + unexpected + flaky + skipped} | ✅ Passed: ${expected} | ❌ Failed: ${unexpected} | ⚠️ Flaky: ${flaky} | ⏭️ Skipped: ${skipped}`,
      `Duration: ${(duration / 1000).toFixed(1)} seconds`
    );
    const { failed, flaky: flakyTests } = collectIssues(report);
    lines.push(
      ...listSection('*Failed tests:*', '❌', failed),
      ...listSection('*Flaky tests (passed on retry):*', '⚠️', flakyTests)
    );
  } else {
    lines.push(`Test job: ${escapeSlack(env.JOB_STATUS || 'unknown')} | No JSON report available (setup or execution may have failed).`);
  }

  const links = [];
  if (env.ALLURE_HTML_URL) links.push(`<${env.ALLURE_HTML_URL}|Download Allure report (HTML)>`);
  if (env.PAGES_URL) {
    const base = env.PAGES_URL.endsWith('/') ? env.PAGES_URL : `${env.PAGES_URL}/`;
    links.push(`<${base}allure/|Allure Report>`, `<${base}playwright/|Playwright Report>`);
  }
  if (env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID) {
    links.push(`<${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}|Run & downloadable artifacts>`);
  }
  if (links.length) lines.push(links.join(' | '));

  return { text: lines.join('\n'), unfurl_links: false, unfurl_media: false };
}

async function main() {
  if (!process.env.SLACK_WEBHOOK_URL) {
    if (process.env.EXTERNAL_PR === 'true') {
      console.warn('Slack notification skipped: GitHub does not expose secrets to fork PRs.');
      return;
    }
    throw new Error('Slack webhook unavailable');
  }
  let report;
  try {
    report = JSON.parse(readFileSync('playwright-summary.json', 'utf8'));
  } catch {
    console.warn('Playwright JSON summary unavailable; sending workflow status only.');
  }
  const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildMessage(report, process.env)),
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Slack returned a non-success response');
  console.log('Slack notification delivered.');
}

module.exports = { buildMessage };
if (require.main === module) {
  main().catch(() => {
    // Never print fetch errors or webhook URLs.
    console.error('Slack notification failed. Check webhook configuration and availability.');
    process.exitCode = 1;
  });
}
