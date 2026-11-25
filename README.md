# FinMore — UI test automation

Playwright + TypeScript UI tests for the FinMore stand (<https://finmore.netlify.app>), with a test tracker (PASS/FAIL, failing step, video evidence), Allure and Playwright HTML reports, GitHub Actions and Slack notifications.

## 1. Purpose and scope

- **5 test cases, UI only, Chromium only** (`TC-01`…`TC-05`, 19 tests with parametrised rows):

  | TC | File | What |
  |----|------|------|
  | TC-01 | `tests/login.spec.ts` | Login page: fields, show/hide password, validation rows, link to registration |
  | TC-02 | `tests/login.spec.ts` | Login with an unregistered user |
  | TC-03 | `tests/registration.spec.ts` | Registration page: fields, show/hide toggles, link back to login |
  | TC-04 | `tests/registration.spec.ts` | Registration: success, validation rows, duplicate email |
  | TC-05 | `tests/login.spec.ts` | Login with a user registered through the UI, then logout |

- The stand is a **single-URL SPA** (`/`) with no deep links, and keeps its users in the browser's `localStorage`. Each test gets a fresh browser context, so users never leak between tests.

## 2. Prerequisites

- **Node.js LTS** (22+; the project uses `process.loadEnvFile`).
- **Java** (JRE/JDK) — required by Allure CLI 2 for local report generation (CI runners have it).
- Windows and macOS are supported; all tooling is Node-based (no PowerShell/bash scripts).

## 3. Setup

```sh
npm install
npx playwright install chromium
```

Then copy `.env.example` to `.env.local` (git-ignored) and adjust what you need. Every variable is optional.

## 4. Environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `BASE_URL` | Target environment | `https://finmore.netlify.app` (`config/env.ts`) |
| `WORKERS` | Local workers (CI always uses 1) | Playwright default |
| `LOG_LEVEL` | `DEBUG` / `INFO` / `WARN` / `ERROR` | `INFO` |
| `TEST_EMAIL_DOMAIN` | Domain of generated users | `example.com` |
| `NO_REPORT_OPEN` | Set to `1` to skip auto-opening Allure locally | unset |
| `STORE_GENERATED_USERS` | `0` disables the local `.runtime/users/` store | on locally, off in CI |
| `SLACK_WEBHOOK_URL` | Local Slack reporter (CI uses the GitHub Secret) | unset |
| `EVIDENCE_PACE` | Video speed: `user` (quick human), `fast` (half the pauses), `off` | `user` |
| `EVIDENCE_FFMPEG` | Path of a full FFmpeg to use instead of the bundled one | bundled |

Real environment variables win over `.env.local`. To target another environment for one run:

```powershell
# PowerShell
$env:BASE_URL = "https://staging.example.com"; npm test
```

```sh
# bash / zsh (macOS)
BASE_URL=https://staging.example.com npm test
```

## 5. Commands

| Command | What |
|---------|------|
| `npm test` | Run everything; opens the tracker and Allure afterwards (unless `NO_REPORT_OPEN` is set) |
| `npx playwright test tests/login.spec.ts` | One file |
| `npx playwright test -g "TC-04A"` | One test by title |
| `npx playwright test --repeat-each=5` | Flakiness check |
| `npm run typecheck` | TypeScript check |
| `npm run report:html` | Open the last Playwright HTML report |
| `npm run report:allure` | Generate and open Allure from `allure-results` |
| `npm run report:tracker` | Open the last neon tracker report (`tracker-report/index.html`) |
| `npm run test:evidence -- tests/login.spec.ts` | Evidence Mode: a screenshot after every assertion, 1440×900 video and trace for **every** test |

Note: passing `--reporter=…` on the command line replaces the reporters from the config, so no Allure results are written for such a run.

## 6. Structure and architecture rules

```
config/      env.ts (default URL, lazy env getters), Logger.ts
Data/        login.json, registration.json, dashboard.json (inputs + expected results), generators.ts (unique users)
fixtures/    index.ts — extended `test`: page objects, newUser, registeredUser; evidence.ts — Evidence Layer
helpers/     userStore.ts — local store of generated users
pages/       BasePage.ts, LoginPage.ts, RegistrationPage.ts, DashboardPage.ts
reporters/   neon-tracker.ts — test tracker (HTML); evidence-files.ts — publishes evidence/<spec>/; local-slack.ts — optional local Slack summary
scripts/     run-evidence.cjs, open-tracker.cjs, serve-report.cjs (windowless Allure server)
evidence/    generated, git-ignored: one folder per spec with <spec>.video.mp4 and <spec>.tcN.screenshot.png
tests/       *.spec.ts
.github/     workflows/playwright.yml, scripts/playwright-slack.cjs
```

Rules:

- **Locators, actions and assertions live in Page Objects.** Specs contain no `expect(...)`, no raw locators and no hard-coded texts; they import `{ test }` from `fixtures` only.
- **Locator priority:** `getByTestId` → `getByRole` → `getByLabel` → other stable. (The stand has `data-testid` everywhere; its labels are not linked to inputs, so `getByLabel` is not usable.) A locator is declared once, fields are scoped from their form.
- **Data:** static inputs and expected results in JSON; unique/dynamic data only via `Data/generators.ts`. Test titles contain only the JSON `case` label (never emails or passwords), because Slack shows titles.
- **Sensitive values** (`{ sensitive: true }` in `BasePage.fill/expectValue`) are masked in logs and step titles.
- **Independence:** every test creates its own data/preconditions; safe under `fullyParallel`.

## 7. How to add…

- **a test:** add a JSON row (parametrised) or a `test(...)` in the right spec; wrap logical stages in `test.step`; assert only through Page Object methods.
- **a page object:** extend `BasePage`, declare locators once in the constructor (scope from the form), add actions and `expect…` methods, expose it in `fixtures/index.ts`.
- **a data file:** put it in `Data/`, keep expected texts there, import it in the spec and pass it to the page object.

## 8. Reports and diagnostics

- **Test tracker** (`tracker-report/index.html`): opens automatically after a local run, next to Allure (not on CI, not with `NO_REPORT_OPEN`; reopen with `npm run report:tracker`). It lists every test as PASS / FAIL / FLAKY, failures first. For each failure it shows **the exact failing step** ("FAILED HERE" in the step timeline, plus the spec and page-object line), a **probable diagnosis** (probable app bug / test issue / environment / flaky / "check the screenshot") with Expected vs Received and next steps, and the evidence (inline video, screenshots, trace) with download buttons. The project link in the header comes from `baseURL`. Durations read `0.95 s`, `19.6 s`, and from a minute `1 m 34 s`. Keys: `N` / `P` jump between failures, `/` searches. The diagnosis is a heuristic on the error text: a hint, not a verdict.
- **Evidence (every run, every test):** each UI test gets a video (step captions, click highlights) and a final screenshot, published per spec into the git-ignored `evidence/` folder: `evidence/<spec>/<spec>.video.mp4` (all tests of the spec in one file) and `<spec>.tcN.screenshot.png`. A new run replaces the files of the specs it executed and leaves other specs alone. A failed test also gets an annotated failure screenshot and a trace. `npm run test:evidence` adds a screenshot after every assertion, a 1440×900 video and a trace for every test.
- **Video speed:** the recording plays at the speed of a quick user, not at automation speed: short pauses after steps and typing at 45 ms per character (`EVIDENCE_PACE=fast` halves the pauses, `off` disables pacing). The suite is slower with pacing on. Only steps made through `BasePage` are paced.
- MP4 conversion uses the bundled `@ffmpeg-installer/ffmpeg` (override with `EVIDENCE_FFMPEG`; the raw WebM stays if conversion fails).
- **Playwright HTML:** `playwright-report/` (`npm run report:html`).
- **Allure:** `allure-report/` is served by a small windowless node server (`scripts/serve-report.cjs`) on port 5050 (or the next free one) and opened after `npm test`; the next run stops the previous server and starts a fresh one. The results folder is wiped at the start of each run.
- Open a trace with `npx playwright show-trace <path>/trace.zip`.
- **CI artifacts** (run page → Artifacts, 30 days): `playwright-report`, `allure-report`, `neon-tracker` (unzip, open `index.html`; evidence stays next to it), `allure-report-html` (single `index.html`), `allure-results`, `test-results`, `playwright-summary`.

## 9. CI (GitHub Actions)

`.github/workflows/playwright.yml` — triggers: push to `main`, pull requests, manual (`workflow_dispatch`, optional `base_url`), and **daily at 00:07 `Europe/Kyiv`** (the minute is deliberately not :00: GitHub documents that scheduled runs are delayed most at the start of every hour, and delays of several hours were observed, so a run can start much later than the configured time — the Slack message and run page show the real start). Jobs: `ui` (typecheck, tests, Allure, artifacts) → `pages` (optional) → `notify` (Slack, always). CI uses 1 worker and 2 retries.

Configure in the GitHub repository (Settings → Secrets and variables → Actions):

- **Secret** `SLACK_WEBHOOK_URL` (required for the notify job; fork PRs are skipped).
- **Variables** (optional): `BASE_URL`, `TEST_EMAIL_DOMAIN`, `PUBLISH_PAGES=true`.

GitHub Pages: Settings → Pages → Source = **GitHub Actions**, then set the variable `PUBLISH_PAGES=true`. The site (`/tracker/`, `/allure/`, `/playwright/`) is **public**, and the Playwright report records typed values, so the project must use throw-away data only. With Pages on, the Slack links `Report`, `Report Al` and `Report PW` open straight in the browser; without Pages they are zip downloads.

If GitHub rejects the `timezone:` key of the schedule, replace it with two crons (`0 15 * * *` and `0 16 * * *`, UTC) and a first `gate` job that continues only when `TZ=Europe/Kyiv date +%H` is `18`.

## 10. Slack

After every CI run: status (✅ / ⚠️ passed with flaky / ❌), repository, branch, trigger and run number, environment, totals (passed/failed/flaky/skipped), duration (`3 m 47 s`), **failed and flaky test titles with `file:line`** (max 15 each), and one line of links: `Report` (test tracker), `Report Al` (Allure), `Report PW` (Playwright HTML), `GitHub` (the Actions run). With Pages on, the first three open straight in the browser; without Pages they point to the artifact zips and are labelled `(zip)`. Errors, stack traces, emails and passwords are never included.

Locally, `reporters/local-slack.ts` sends the same kind of summary after a run **only if** `SLACK_WEBHOOK_URL` is set in `.env.local`. Remove the reporter from `playwright.config.ts` if you do not want it.

## 11. Security notes

- No secrets in Git: `.env.local` and `.runtime/` are ignored; `.env.example` has empty values only.
- Tests only type **throw-away generated** credentials (and public demo/fixture values). Never put a real password into a test or into a CI secret used by the tests.
- Console logs, step titles and the Allure report mask passwords. Playwright's own HTML report and traces still record typed values in their internal `fill` steps, and screenshots/videos show the page, so everything published (artifacts, Pages) must come from throw-away data.
- `.runtime/users/<id>.json` (one file per generated user, mode `0600` where supported, local only, never uploaded or logged) exists for manual debugging; tests do not read it.

## 12. Limitations

- No Allure trend history across CI runs (each Pages deploy replaces the previous report).
- No cleanup is needed or possible: users live in the per-test browser context's `localStorage` and vanish with it. Never clear browser storage inside a test — that would delete the registered user.
- No deep links: the registration page is reached only through the login page link.
- Chromium only.
- Evidence pacing makes a local run take roughly 2 minutes instead of 20 seconds (`EVIDENCE_PACE=off` restores the speed).

## 13. Definition of Done

See Section 16 of `IMPLEMENTATION_PLAN.md`.
