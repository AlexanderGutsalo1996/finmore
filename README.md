# FinMore — UI test automation

Playwright + TypeScript UI tests for the FinMore stand (<https://finmore.netlify.app>), with Allure and Playwright HTML reports, GitHub Actions and Slack notifications.

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
| `npm test` | Run everything (generates and opens Allure afterwards, unless `NO_REPORT_OPEN` is set) |
| `npx playwright test tests/login.spec.ts` | One file |
| `npx playwright test -g "TC-04A"` | One test by title |
| `npx playwright test --repeat-each=5` | Flakiness check |
| `npm run typecheck` | TypeScript check |
| `npm run report:html` | Open the last Playwright HTML report |
| `npm run report:allure` | Generate and open Allure from `allure-results` |

Note: passing `--reporter=…` on the command line replaces the reporters from the config, so no Allure results are written for such a run.

## 6. Structure and architecture rules

```
config/      env.ts (default URL, lazy env getters), Logger.ts
Data/        login.json, registration.json, dashboard.json (inputs + expected results), generators.ts (unique users)
fixtures/    index.ts — extended `test`: page objects, newUser, registeredUser
helpers/     userStore.ts — local store of generated users
pages/       BasePage.ts, LoginPage.ts, RegistrationPage.ts, DashboardPage.ts
reporters/   local-slack.ts — optional local Slack summary
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

- **Playwright HTML:** `playwright-report/` (`npm run report:html`).
- **Allure:** `allure-report/`, auto-opened locally on port 5050 after `npm test` (the detached server may keep running; a later run just needs a browser refresh). Results folder is wiped at the start of each run.
- On failure: screenshot, trace and video (`test-results/`). Open a trace with `npx playwright show-trace <path>/trace.zip`.
- **CI artifacts** (run page → Artifacts, 30 days): `playwright-report`, `allure-report`, `allure-report-html` (single `index.html`, opens by double-click), `allure-results`, `test-results`, `playwright-summary`.

## 9. CI (GitHub Actions)

`.github/workflows/playwright.yml` — triggers: push to `main`, pull requests, manual (`workflow_dispatch`, optional `base_url`), and **daily at 18:00 `Europe/Kyiv`**. Jobs: `ui` (typecheck, tests, Allure, artifacts) → `pages` (optional) → `notify` (Slack, always). CI uses 1 worker and 2 retries.

Configure in the GitHub repository (Settings → Secrets and variables → Actions):

- **Secret** `SLACK_WEBHOOK_URL` (required for the notify job; fork PRs are skipped).
- **Variables** (optional): `BASE_URL`, `TEST_EMAIL_DOMAIN`, `PUBLISH_PAGES=true`.

GitHub Pages (optional): Settings → Pages → Source = **GitHub Actions**, then set `PUBLISH_PAGES=true`. The site (Allure at `/allure/`, Playwright at `/playwright/`) is **public** unless your plan has private Pages, and the Playwright report includes failure traces with typed throw-away inputs, so keep it off if that is not acceptable.

If GitHub rejects the `timezone:` key of the schedule, replace it with two crons (`0 15 * * *` and `0 16 * * *`, UTC) and a first `gate` job that continues only when `TZ=Europe/Kyiv date +%H` is `18`.

## 10. Slack

After every CI run: status (✅ / ⚠️ passed with flaky / ❌), repository, branch, trigger and run number, environment, totals (passed/failed/flaky/skipped), duration, **failed and flaky test titles with `file:line`** (max 15 each), a direct link to the single-file Allure HTML artifact, Pages links when published, and the run link. Errors, stack traces, emails and passwords are never included.

Locally, `reporters/local-slack.ts` sends the same kind of summary after a run **only if** `SLACK_WEBHOOK_URL` is set in `.env.local`. Remove the reporter from `playwright.config.ts` if you do not want it.

## 11. Security notes

- No secrets in Git: `.env.local` and `.runtime/` are ignored; `.env.example` has empty values only.
- Tests only type **throw-away generated** credentials (and public demo/fixture values). Never put a real password into a test.
- Console logs and the Allure report mask passwords. Playwright's own HTML report and traces still record typed values in their internal `fill` steps — another reason to use throw-away data only.
- `.runtime/users/<id>.json` (one file per generated user, mode `0600` where supported, local only, never uploaded or logged) exists for manual debugging; tests do not read it.

## 12. Limitations

- No Allure trend history across CI runs (each Pages deploy replaces the previous report).
- No cleanup is needed or possible: users live in the per-test browser context's `localStorage` and vanish with it. Never clear browser storage inside a test — that would delete the registered user.
- No deep links: the registration page is reached only through the login page link.
- Chromium only.

## 13. Definition of Done

See Section 16 of `IMPLEMENTATION_PLAN.md`.
