// Traceability check: npm run check:requirements
// - every test must name the requirement(s) it verifies (annotation type "requirement", IDs separated by commas)
// - every ID must exist in requirements/requirements.json
// - every requirement must be covered by at least one test
// Unconfirmed requirements (confirmed: false) are reported as a warning: the expected results then rest on observed behaviour only.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const register = JSON.parse(fs.readFileSync(path.join(root, 'requirements', 'requirements.json'), 'utf8'));
const known = new Map(register.requirements.map((r) => [r.id, r]));

const cli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
const run = spawnSync(process.execPath, [cli, 'test', '--list', '--reporter=json'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (run.status !== 0 && !run.stdout) {
  console.error('Could not list the tests:\n' + run.stderr);
  process.exit(2);
}
const report = JSON.parse(run.stdout);

const tests = [];
const collect = (suite, trail) => {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests) {
      const ids = t.annotations.filter((a) => a.type === 'requirement').flatMap((a) => (a.description ?? '').split(/[ ,;]+/)).filter(Boolean);
      tests.push({ title: spec.title, file: spec.file, ids });
    }
  }
  for (const child of suite.suites ?? []) collect(child, trail);
};
for (const suite of report.suites) collect(suite, []);

const problems = [];
const covered = new Map();
for (const t of tests) {
  if (!t.ids.length) problems.push('no requirement linked: ' + t.file + ' :: ' + t.title);
  for (const id of t.ids) {
    if (!known.has(id)) problems.push('unknown requirement ' + id + ': ' + t.file + ' :: ' + t.title);
    else covered.set(id, (covered.get(id) ?? 0) + 1);
  }
}
for (const id of known.keys()) if (!covered.has(id)) problems.push('requirement without a test: ' + id);

console.log('Requirement'.padEnd(10) + 'Tests  Basis');
for (const [id, r] of known) console.log(id.padEnd(10) + String(covered.get(id) ?? 0).padEnd(7) + (r.confirmed ? 'confirmed' : 'unconfirmed (' + r.source + ')'));

const unconfirmed = [...known.values()].filter((r) => !r.confirmed).length;
console.log('\n' + tests.length + ' tests, ' + known.size + ' requirements, ' + problems.length + ' problem(s)');
if (unconfirmed) console.log('WARNING: ' + unconfirmed + ' of ' + known.size + ' requirements are unconfirmed: the expected results rest on observed behaviour, not on an agreed specification.');
for (const p of problems) console.log('ERROR ' + p);
process.exit(problems.length ? 1 : 0);
