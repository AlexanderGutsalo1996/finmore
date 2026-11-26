// Lints the tests for patterns that make a test pass without proving anything: npm run lint:tests
// ERRORS fail the check (and CI); WARNINGS are listed only.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const walk = (dir) =>
  !fs.existsSync(dir)
    ? []
    : fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const files = [...walk(path.join(root, 'tests')), ...walk(path.join(root, 'pages'))].filter((f) => f.endsWith('.ts'));

const problems = [];
const add = (level, file, index, text, rule, message) => {
  const line = text.slice(0, index).split('\n').length;
  if (text.split('\n')[line - 1].includes('lint-ok')) return; // explicitly allowed on this line, with a reason
  problems.push({ level, where: path.relative(root, file).split(path.sep).join('/') + ':' + line, rule, message });
};

const RULES = [
  ['error', 'swallowed-error', /[.]catch[(]\s*[(]\s*[)]\s*=>\s*[{]\s*[}]\s*[)]/g, 'an error is swallowed, so a failure can never fail the test'],
  ['error', 'skip-or-only', /\btest[.](skip|fixme|only)\s*[(]|\bdescribe[.]only\s*[(]/g, 'tests must not be skipped or focused: remove the test or fix it'],
  ['error', 'force-action', /\bforce:\s*true\b/g, 'force: true bypasses the checks a real user would hit (visible, enabled, not covered)'],
  ['error', 'fixed-wait', /\bwaitForTimeout\s*[(]/g, 'a fixed wait hides timing problems: assert the state that must come first'],
  ['warning', 'weak-assertion', /[.]not[.]toHave(URL|Title)\b|\btoBeTruthy\s*[(]|\btoBeDefined\s*[(]|\bexpect\s*[(]\s*true\s*[)]/g, 'a weak assertion: prefer checking the exact expected outcome'],
  ['warning', 'negative-url-only', /expectUrl\s*[(]\s*\/\^[(][?]!/g, 'only checks that the URL is NOT somewhere; also assert a positive sign of the expected page'],
];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const [level, rule, re, message] of RULES) {
    for (const m of text.matchAll(re)) add(level, file, m.index, text, rule, message);
  }

  if (!file.endsWith('.spec.ts')) continue;
  // Every test must assert something, and not only that something is absent.
  const starts = [...text.matchAll(/^\s*test\s*[(]/gm)].map((m) => m.index);
  starts.forEach((start, i) => {
    const block = text.slice(start, starts[i + 1] ?? text.length);
    const calls = [...block.matchAll(/[.](expect\w*|check\w*)\s*[(]/g)].map((m) => m[1]).concat([...block.matchAll(/\bexpect\s*[(]/g)].map(() => 'expect'));
    if (!calls.length) add('error', file, start, text, 'no-assertion', 'the test contains no assertion at all');
    else if (calls.every((c) => c === 'expectHidden' || c === 'expectNotLoggedIn')) add('error', file, start, text, 'absence-only', 'the test only checks that something is absent: add a check of the positive outcome');
  });
}

const errors = problems.filter((p) => p.level === 'error');
const warnings = problems.filter((p) => p.level === 'warning');
for (const p of [...errors, ...warnings]) console.log((p.level === 'error' ? 'ERROR  ' : 'warning') + ' ' + p.where + '  [' + p.rule + '] ' + p.message);
console.log('\nlint:tests: ' + files.length + ' files, ' + errors.length + ' error(s), ' + warnings.length + ' warning(s)');
process.exit(errors.length ? 1 : 0);
