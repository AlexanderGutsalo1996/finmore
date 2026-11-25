# IMPLEMENTATION_PLAN.md — FinMore UI Test Automation

> **Audience:** an AI coding agent that will implement, configure, run and verify this framework.
> **Status:** plan only — nothing is implemented yet.
> **Stack:** Playwright + TypeScript · Chromium · Allure + Playwright HTML Report · GitHub Actions · Slack.
> **Based on:** a review of the reference project (Section 2) and a static check of the test stand (Section 3).

---

## 0. Editable Parameters (change values here; the rest of the plan refers to them by name)

| Parameter | Current value | Used for |
|-----------|---------------|----------|
| `<REFERENCE_PROJECT>` | `D:\Studying\Playwright\premiereonline` | **Read-only** source of reusable solutions. Never modify it. |
| `<APP_URL>` | `https://finmore.netlify.app` | Default `BASE_URL` of the test stand. Written in exactly **two** places: `config/env.ts` (`DEFAULT_BASE_URL`) and `.env.example`. |
| `<NEW_PROJECT_DIR>` | `D:\Studying\Playwright\finmore` | Root of the new automation project. It currently looks empty (no sub-folders, no `.git`) — the agent must confirm before writing. |
| `<NEW_GITHUB_REPO>` | `https://github.com/AlexanderGutsalo1996/finmore` | CI, Secrets, Variables and Pages. Created by the user (empty — no README/.gitignore/license). Before the first push the agent must confirm visibility (Private expected) and that the Secret `SLACK_WEBHOOK_URL` exists. Reference repo (for orientation): `AlexanderGutsalo1996/premierOnline`. |

Other tunables (defaults are in the sections referenced):

| Tunable | Default | Section |
|---------|---------|---------|
| Schedule | daily 00:07 `Europe/Kyiv` (off the :00 mark: GitHub delays scheduled runs most at the start of every hour) | 12 |
| Allure local port | `5050` (as in reference) | 11 |
| Pages publishing | off until repo variable `PUBLISH_PAGES=true` | 12 |
| Playwright version / Node | as in reference (`^1.63.0`) / Node LTS | 7.1 |

**Agent rule:** whenever a parameter above changes, only this table needs editing; always use the parameter's current value, never a copy of it from another section of this plan.

---

## 1. Rules for the Agent

1. Work in `<NEW_PROJECT_DIR>`. **Read** `<REFERENCE_PROJECT>` only to copy/adapt code. Never write there. Never open, copy or print: `.env.local`, `Data/authData.json`, `node_modules/`, `allure-*`, `playwright-report/`, `test-results/`, `.git/`.
2. Execute phases in order (Section 5). Phase 0 (Discovery) is mandatory — the stand's DOM is unknown.
3. Everything marked `TBD` must be replaced with discovered values and recorded in **Appendix A**.
4. Stop and ask the user when a **Stop Condition** (Section 4.3) is hit.
5. Minimal footprint: no dependency, folder or abstraction that is not listed here.
6. **Git:** do not `git init`, commit, push, merge or create branches/PRs without explicit user approval. At the end give a summary and a suggested commit message.
7. **Secrets:** never place a secret, token, webhook or real credential in Git, logs, reports, Allure attachments or Slack messages.
8. Verify each phase with the commands in its "Verify" block before continuing.
9. **`.env.local`:** create it in Phase 1 as a copy of `.env.example` (Section 7.2) and keep it git-ignored. After creating it, never read, print, edit, overwrite or commit it — the user adds secrets there (e.g. `SLACK_WEBHOOK_URL`). Use process environment variables for temporary switches during verification.

---

## 2. Reference Project Analysis (`<REFERENCE_PROJECT>`)

Verified by reading the files listed (secrets were not read or printed). Repo flow in the reference: `main` + feature branches merged via PRs.

### 2.1 What exists

| Area | Reference implementation (verified) |
|------|-------------------------------------|
| Layout | Root-level folders: `pages/` (+ `pages/Components/`), `tests/`, `Data/`, `config/`, `reporters/`, `.github/{workflows,scripts}/`, `allure-teardown.ts`. No `src/`. |
| Config | `playwright.config.ts`: loads `.env.local` via Node's built-in `loadEnvFile` (no dotenv needed); `fullyParallel`, `forbidOnly: !!CI`, `retries: CI ? 2 : 0`, `workers: CI ? 1 : undefined`; reporters `list`, `html {open:'never'}`, `allure-playwright {resultsDir:'allure-results'}`; CI adds `json → playwright-summary.json`, local adds `./reporters/local-slack.ts`; `globalTeardown: './allure-teardown.ts'` only when not CI; Chromium only; `trace: 'on-first-retry'`; **`baseURL` hard-coded**. |
| tsconfig | `target ES2022`, `module/moduleResolution NodeNext`, `resolveJsonModule`, `strict`, `noEmit`, `skipLibCheck`, `include **/*.ts`. No path aliases. |
| package.json | `@playwright/test ^1.63.0`, `allure-playwright ^3.15.0`, `allure-commandline ^2.46.1` (Allure 2 → needs Java), `typescript ^7.0.2`, `@types/node ^26.6.5`, `dotenv ^18.0.9`. **No npm scripts.** |
| BasePage | `abstract BasePage` with `step()` (logs via `Logger` + wraps `test.step`, logs failure reason), generic actions (`goto`, `click` with visible+enabled pre-checks, `fill`, `check`, `selectOption`, …), getters, and many `expect*` assertions (`expectVisible`, `expectText`, `expectValue`, `expectAttribute`, `expectUrl`, …). Each takes an optional human-readable `name`. |
| Page Objects | `SignInPage`, `RegisterPage` (file `RegistePage.ts` — typo), etc. Pattern: a **form locator** is declared once and child fields are scoped from it (`this.signInForm.locator('#login_name')`); methods like `checkSignInForm()`, `fillSignInForm(data)`, `submitSignIn()`; roles used for buttons/links. Page objects hold locators + actions + assertions. |
| Tests | `test.describe` + `beforeEach` creating the page object; logical stages in `test.step`. No fixtures. Some specs still import `expect`/`dotenv` directly. |
| Data | `Data/authData.json` (static input), `Data/registration.ts` (generator: name lists, `randomUUID` suffix email, `example.com`, `overrides`). |
| Logger | `config/Logger.ts` — small level-based logger (`LOG_LEVEL`). |
| Allure (local) | `allure-teardown.ts` generates the report (`generate allure-results --clean -o allure-report`) and opens it detached on port 5050 — but calls **`allure.cmd` (Windows only)**. CI does not generate Allure. |
| CI | `.github/workflows/playwright.yml`: triggers push `main`, PR, manual, schedule **`cron '0 18 * * *'` with `timezone: 'Europe/Kyiv'`**; single job; Node `lts/*`; `npm ci`; `npx playwright install --with-deps chromium`; secrets passed as env; uploads `playwright-report` (30 days); Slack step `if: !cancelled()`. |
| Slack (CI) | `.github/scripts/playwright-slack.cjs` (CommonJS, exports `buildMessage`): reads `playwright-summary.json`; shows Total / Passed / Failed / Flaky / Skipped, duration (s), **failed/flaky test locations (`file:line`, max 15)** — deliberately **not** titles/errors to avoid leaking credentials; escapes `& < >`; link to the run; `redirect:'error'`, 15 s timeout; never prints webhook/errors; skips for fork PRs; fails if webhook missing. |
| Slack (local) | `reporters/local-slack.ts` — custom reporter, sends the same kind of summary after local runs; skipped on CI, without executed tests, or without `SLACK_WEBHOOK_URL`. |
| Secrets | `.env.local` is git-ignored (`.env.*` + `!.env.example`); `.env.example` lists keys only. |
| API | `pages/PostsService.ts` + `tests/api_test*.spec.ts` (Service Object Model) — **not applicable** to this UI-only task. |

### 2.2 Reuse decision

| Component | Decision | Notes |
|-----------|----------|-------|
| Folder layout (root-level `pages/ tests/ Data/ config/ reporters/`) | **Reuse** | Keeps both projects consistent; no `src/`, no path aliases. |
| `loadEnvFile` for `.env.local`, `.env.example` pattern, `.gitignore` rules | **Reuse** | **Drop `dotenv`** (redundant). Create env files **without BOM** (reference files start with a BOM). |
| `config/Logger.ts` | **Reuse as is** | |
| `BasePage` (`step`, actions, `expect*`) | **Reuse + trim + harden** | Keep only methods used here plus clearly generic ones; remove oddities (`performClick` 5-click, commented `try/catch`); **mask sensitive values** in step titles/logs (reference logs `Fill "<value>"` — passwords would appear in logs and Allure). |
| Form-scoped locator pattern | **Reuse** | Avoids duplicated locators. |
| `Data/registration.ts` generator idea | **Reuse (renamed `Data/generators.ts`)** | Move the `RegistrationData` type next to the generator (reference imports a type from a Page Object into Data). |
| `allure-teardown.ts` | **Reuse + fix** | Cross-platform binary (`allure.cmd` on Windows, `allure` on macOS/Linux); skip when `CI` or `NO_REPORT_OPEN`. |
| Reporter set in config | **Reuse + extend** | Add `screenshot/video/trace` on failure, configurable local workers, env-driven `baseURL`. |
| Workflow file | **Reuse + extend** | Keep triggers (incl. native `timezone`), Node, install steps; add Allure, artifacts, Pages, separate `notify` job. |
| `playwright-slack.cjs` | **Reuse + extend** | Add failed test **names**, flaky names, Allure/Playwright report links, "passed with flaky" status. |
| `reporters/local-slack.ts` | **Reuse (optional)** | Active only if `SLACK_WEBHOOK_URL` is in `.env.local`; remove if the user does not want local Slack messages (Decision D4). |
| `Data/authData.json` | **Do not reuse** | Contains a credential pair and **is tracked by Git** (see 2.3). |
| `PostsService` / API specs / `HelpChat`, `Footer`, `Header`, `Cookie` components | **Not reused** | UI-only scope; components only if FinMore shares such blocks. |
| `dotenv`, `md5`/`crypt` (transitive) | **Not reused** | |

### 2.3 Findings to carry into the new project (risks in the reference)
1. `Data/authData.json` is tracked in Git and has `valid` credentials → **possible exposed credentials; the user should check whether they are real and rotate them.** The new project must never store real credentials in tracked files.
2. `BasePage.fill()` prints entered values into logs, Allure/Playwright step titles → must be masked.
3. `allure-teardown.ts` is Windows-only (`allure.cmd`) → fails on macOS (requirement: Windows + macOS).
4. `package.json` has no scripts; `baseURL` is hard-coded; Allure is not generated in CI; Pages not used.
5. Registration there stops before submit because of **reCAPTCHA** — FinMore may behave differently (Stop Condition S3).
6. `.env.local` also contains a Slack webhook and other secrets → it must stay git-ignored (already is).
7. Allure CLI 2 requires **Java** (present locally; on `ubuntu-latest` runners Java is preinstalled — verify, add `actions/setup-java` only if missing).

---

## 3. Test Stand Analysis (`<APP_URL>`)

Static fetch result: the HTML `<title>` is "Повнофункціональний фінансовий менеджер" ("Full-featured financial manager") and the body contains no rendered markup → **client-side SPA, probably Ukrainian UI**. Fields, `data-testid`, validation and persistence **could not be inspected statically** — Phase 0 must inspect the live app (Playwright codegen / a throw-away script, not committed).

| # | Hypothesis to verify | If true | If false |
|---|----------------------|---------|----------|
| H1 | Users are kept in **browser storage** (no backend) | `registeredUser` must register **in the test's own context** and log out via UI — never clear storage; cleanup = discard context | Unique users required; cleanup depends on delete-account support |
| H2 | Registration auto-logs the user in | Fixture logs out through UI before the test body | Fixture just returns credentials |
| H3 | Email verification exists | Mailbox integration (Section 8.7) — **Stop S2** | Not needed |
| H4 | Native HTML5 validation | Assertions read `validationMessage` | Assertions read rendered error text |
| H5 | Delete-account (UI/API) exists | Implement cleanup (8.6) | Cleanup is a documented no-op |
| H6 | `data-testid` present | Primary locator strategy | Fall back to role → label → other stable; list missing ids (Appendix A.5) |
| H7 | CAPTCHA / rate limit on auth forms | — | **Stop S3** |

---

## 4. Assumptions, Decisions, Questions, Stop Conditions

### 4.1 Assumptions (non-critical)
| # | Assumption |
|---|-----------|
| A1 | Scope is UI only; **Service Object Model is not applicable** (no API job in CI; the workflow structure allows adding one later). |
| A2 | `<NEW_PROJECT_DIR>` is empty and not a Git repo; `<NEW_GITHUB_REPO>` exists on GitHub but is empty. Linking the two (`git init`, `git remote add origin`) and the first push happen **only after user approval**. |
| A3 | UI texts are Ukrainian; every expected text lives in JSON data, never in code. |
| A4 | Test IDs in titles (`TC-01: …`) are naming only — **no tags**, no `--grep`. |
| A5 | Local machine is Windows (user's) and must also work on macOS; all tooling is Node-based (no PowerShell/bash scripts). |
| A6 | GitHub Pages sites are public unless the org has private Pages; hence Pages publishing is opt-in (`PUBLISH_PAGES`). |
| A7 | Allure **trend history** across CI runs is not kept (each Pages deploy replaces the previous report). |
| A8 | Generated users use throw-away passwords; no real credential is ever typed by a test. |

### 4.2 Decisions the user may want to change (defaults apply otherwise)
| # | Decision | Default |
|---|----------|---------|
| D1 | Pages content | Allure at `/allure/`, Playwright HTML at `/playwright/` (the Playwright report embeds failure traces with typed throw-away inputs) |
| D2 | Missing `SLACK_WEBHOOK_URL` in CI | Fail the notify job loudly (as in reference), except for fork PRs where secrets are unavailable |
| D3 | Failed tests in Slack | Show **test titles** (static, credential-free) plus `file:line` |
| D4 | Local Slack reporter | Reuse; sends only if `SLACK_WEBHOOK_URL` exists in `.env.local` |

### 4.3 Critical questions
**None blocking.** Start with Phase 0. Ask the user only if a Stop Condition is hit.

### 4.4 Stop Conditions (ask the user)
| ID | Condition |
|----|-----------|
| S1 | Most required `data-testid` are missing and role/label locators are not stable |
| S2 | Registration requires **email verification** (need mailbox provider + credentials) |
| S3 | CAPTCHA / bot protection / strict rate limits on login or registration |
| S4 | The only cleanup path is an admin/destructive API or DB access |
| S5 | A step needs a real secret that was not provided |
| S6 | `<NEW_PROJECT_DIR>` is not empty or is already a Git repo |

---

## 5. Implementation Phases

### Phase 0 — Discovery (no framework code)
- [ ] Confirm `<NEW_PROJECT_DIR>` state (S6). Confirm the reference files listed in Section 2 still exist.
- [ ] Inspect the live stand (`<APP_URL>`) with Playwright codegen or a throw-away script: routes, headings, every field (label, placeholder, type, required), buttons/links (+ `href`s), password show/hide toggle, error/success containers, best locator per element (testid → role → label → other).
- [ ] Record validation rules/messages (native vs custom, trigger: submit/blur), password rules, duplicate-email behaviour, confirm-password field.
- [ ] Record post-registration/post-login behaviour (redirect, success text, auto-login, logged-in indicator, logout).
- [ ] Verify H1–H7. Evaluate Stop Conditions.
- [ ] Fill **Appendix A**.

**Verify:** no `TBD` remains for anything a test depends on.

### Phase 1 — Bootstrap `<NEW_PROJECT_DIR>`
- [ ] Copy/adapt from `<REFERENCE_PROJECT>`: `tsconfig.json`, `.gitignore` (+ `.runtime/`, `site/`, `playwright-summary.json` already there), `config/Logger.ts`.
- [ ] Create `package.json` (Section 7.1), `.env.example` (7.2), `config/env.ts` (7.3).
- [ ] Create **`.env.local`** as a plain copy of `.env.example` (no BOM, `SLACK_WEBHOOK_URL` left empty) and confirm it is git-ignored (rule `.env.*` in `.gitignore`; `git check-ignore -v .env.local` once the repo exists). Never write a secret into it.
- [ ] `npm install`, `npx playwright install chromium`.

**Verify:** `npm run typecheck` passes; `npx playwright --version` works; `.env.local` exists and is ignored by Git.

### Phase 2 — Framework core
- [ ] `playwright.config.ts` (7.4), `allure-teardown.ts` (11.1).
- [ ] `pages/BasePage.ts` (8.1 — trimmed, masked).
- [ ] `Data/*.json`, `Data/generators.ts` (Section 9), `helpers/userStore.ts` (8.6).
- [ ] Page Objects: `LoginPage`, `RegistrationPage`, landing page (name from Appendix A) (8.2).
- [ ] `fixtures/index.ts` (8.4).

**Verify:** `npm run typecheck`; `npx playwright test --list` loads config without errors.

### Phase 3 — Tests
- [ ] `tests/login.spec.ts` (TC-01, TC-02, TC-05), `tests/registration.spec.ts` (TC-03, TC-04) per Section 10.

**Verify:** `npm test` green; Allure opens automatically; `npx playwright test --repeat-each=5` no flakiness.

### Phase 4 — CI/CD and Slack
- [ ] `.github/workflows/playwright.yml` (12), `.github/scripts/playwright-slack.cjs` (13).

**Verify:** Section 15 (local checks only — no push).

### Phase 5 — Documentation and hand-off
- [ ] `README.md` (14); Definition of Done (16); final summary + suggested commit message. **No commit.**

---

## 6. Target Project Structure (`<NEW_PROJECT_DIR>`)

```
finmore/
├── .github/
│   ├── scripts/playwright-slack.cjs
│   └── workflows/playwright.yml
├── config/
│   ├── env.ts                      # DEFAULT_BASE_URL (<APP_URL>) + lazy env getters
│   └── Logger.ts                   # reused as is
├── Data/
│   ├── login.json                  # static inputs + expected results
│   ├── registration.json
│   └── generators.ts               # dynamic unique users (+ RegistrationData type)
├── fixtures/
│   └── index.ts                    # extended `test`
├── helpers/
│   └── userStore.ts                # secure local store of generated users (8.6)
├── pages/
│   ├── BasePage.ts
│   ├── LoginPage.ts
│   ├── RegistrationPage.ts
│   └── <Landing>Page.ts            # post-login page, name from Appendix A
├── reporters/
│   └── local-slack.ts              # reused (optional, D4)
├── tests/
│   ├── login.spec.ts               # TC-01, TC-02, TC-05
│   └── registration.spec.ts        # TC-03, TC-04
├── allure-teardown.ts
├── playwright.config.ts
├── tsconfig.json
├── package.json
├── .env.example
├── .gitignore
├── IMPLEMENTATION_PLAN.md
└── README.md
```
Created **only if discovery requires**: `pages/Components/` (blocks shared by ≥2 pages), `helpers/mailbox.ts` (H3), `helpers/cleanup.ts` (H5).
No `src/`, no `services/`, no path aliases, no ESLint/Prettier.

---

## 7. Configuration

### 7.1 `package.json`
Versions as in the reference (verify at install time; keep Allure CLI 2 + `allure-playwright` 3 unless the user approves a change).
```json
{
  "name": "finmore-autotests",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "test": "playwright test",
    "typecheck": "tsc --noEmit",
    "report:html": "playwright show-report",
    "report:allure": "allure generate allure-results --clean -o allure-report && allure open allure-report"
  },
  "devDependencies": {
    "@playwright/test": "^1.63.0",
    "@types/node": "^26.6.5",
    "allure-commandline": "^2.46.1",
    "allure-playwright": "^3.15.0",
    "typescript": "^7.0.2"
  }
}
```
(Scripts contain no shell-specific syntax → work on Windows and macOS. Env switches like `NO_REPORT_OPEN` go into `.env.local`, not into command lines.)

### 7.2 Environment variables, secrets, `.env` files

| Variable | Local (`.env.local`) | CI | Purpose | Default |
|----------|---------------------|----|---------|---------|
| `BASE_URL` | optional | repo **variable** `BASE_URL` or manual-run input | Target environment | `DEFAULT_BASE_URL` (`<APP_URL>`) |
| `WORKERS` | optional | ignored (CI = 1) | Local workers | Playwright default |
| `LOG_LEVEL` | optional | optional | `DEBUG/INFO/WARN/ERROR` (reference Logger) | `INFO` |
| `TEST_EMAIL_DOMAIN` | optional | repo variable | Domain for generated users | `example.com` |
| `NO_REPORT_OPEN` | optional (`1`) | n/a | Do not auto-open Allure locally | unset |
| `STORE_GENERATED_USERS` | optional (`1`/`0`) | off | Persist generated users locally (8.6) | on locally, off in CI |
| `SLACK_WEBHOOK_URL` | optional (local Slack) | **GitHub Secret** | Slack Incoming Webhook | unset |
| `MAIL_PROVIDER`, `MAIL_API_KEY`, `MAIL_DOMAIN` | only if H3 | **GitHub Secrets** | Test mailbox | unset |
| `PUBLISH_PAGES` | n/a | repo **variable** | `true` enables Pages | unset |

Rules: `.env.local` is git-ignored and loaded with `loadEnvFile` (real env vars win); `.env.example` is committed with **empty values only** and no BOM; CI never uses files — only `vars.*` / `secrets.*`.

**`.env.local` is created by the agent in Phase 1** as a plain copy of `.env.example` (no BOM, all secrets empty) and is never committed. After that the agent must not read, print, edit or overwrite it: the user fills in `SLACK_WEBHOOK_URL` (and any other secret) later — paste **only the value after `=`**, without the key and without quotes (a duplicated key such as `SLACK_WEBHOOK_URL=SLACK_WEBHOOK_URL=https://…` makes the Slack reporter fail). For temporary switches during verification use process environment variables, not `.env.local`.

`.env.example`:
```dotenv
# Target environment (default = <APP_URL>)
BASE_URL=<APP_URL>
# Local workers (CI always uses 1)
WORKERS=2
LOG_LEVEL=INFO
# Domain for generated unique users
TEST_EMAIL_DOMAIN=example.com
# Set to 1 to skip auto-opening the Allure report after local runs
NO_REPORT_OPEN=
# Persist generated users to .runtime/ (local only)
STORE_GENERATED_USERS=1
# Slack Incoming Webhook (local optional; CI uses the GitHub Secret)
SLACK_WEBHOOK_URL=
# Only if email verification is required (see §8.7)
# MAIL_PROVIDER=
# MAIL_API_KEY=
# MAIL_DOMAIN=
```

`.gitignore` = reference rules (`node_modules/`, `/test-results/`, `/playwright-report/`, `/playwright-summary.json`, `/blob-report/`, `/playwright/.cache/`, `/playwright/.auth/`, `/allure-results/`, `/allure-report/`, `.env`, `.env.*`, `!.env.example`) **plus** `/.runtime/` and `/site/`.

### 7.3 `config/env.ts`
```ts
// Single code location of the default stand URL (value from Section 0: <APP_URL>).
export const DEFAULT_BASE_URL = '<APP_URL>';

// Lazy getters: evaluated after .env.local has been loaded.
export const getBaseUrl = () => process.env.BASE_URL || DEFAULT_BASE_URL;   // `||` ignores empty strings
export const getEmailDomain = () => process.env.TEST_EMAIL_DOMAIN || 'example.com';
export const isCI = () => !!process.env.CI;
```

### 7.4 `playwright.config.ts` (adapted from the reference)
```ts
import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { getBaseUrl } from './config/env';   // safe: only declares functions, reads env lazily

const localEnvPath = resolve(__dirname, '.env.local');
if (existsSync(localEnvPath)) loadEnvFile(localEnvPath);

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,                                          // local 0, CI 2
  workers: isCI ? 1 : Number(process.env.WORKERS) || undefined,   // CI 1, local configurable
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['allure-playwright', { resultsDir: 'allure-results' }],
    ...(isCI
      ? [['json', { outputFile: 'playwright-summary.json' }] as ['json', { outputFile: string }]]
      : [['./reporters/local-slack.ts'] as [string]]),
  ],
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
```
Do **not** add commented-out browser projects. Add `timeout`/`expect.timeout` overrides only if Phase 3 shows the need.

---

## 8. Architecture Rules

### 8.1 `BasePage` (reuse + trim + harden)
- Keep: `abstract class`, `protected constructor(page)`, `Logger`, `step()` (logs + `test.step` + failure reason), `label()`, `goto`, `click` (visible+enabled pre-check), `fill`, `check`/`uncheck` (only if needed), `getText`/`getAttribute` (only if used), `expectTitle/Url/Visible/Hidden/Enabled/Disabled/Text/Value/Attribute/Count/Editable`.
- Remove: `performClick`, commented code, methods unused after Phase 3 (`dblClick`, `hover`, `pressKey`, `scrollIntoView`, `actionAndWaitForResponse`, `clickAndVerify` — keep only if a test needs them).
- **Add masking:**
```ts
async fill(locator: Locator, value: string, name?: string, opts?: { sensitive?: boolean }): Promise<void> {
  const shown = opts?.sensitive ? '***' : value;
  await this.step(`Fill "${shown}" into: ${this.label(locator, name)}`, () => locator.fill(value));
}
```
  Every password/token field uses `sensitive: true`. Assertions on values (`expectValue`) must not print sensitive values either (add the same flag).
- Files saved **without BOM**.

### 8.2 Page Objects — locators, actions, assertions in the class
1. One class per page; locators are `readonly` properties created once in the constructor; **no locator is declared twice** anywhere (pages, fixtures, helpers, specs).
2. Scope fields from the form locator (reference pattern), e.g. `this.form.getByTestId(...)`.
3. Priority: `getByTestId` → `getByRole` → `getByLabel` → other stable (`getByPlaceholder`, `getByText` for static copy). CSS/id/XPath only as a last resort with a one-line comment.
4. Assertions are methods of the page class (`expect…`/`check…`), built on the `BasePage.expect*` helpers. **Specs contain no `expect(...)`, no `page.locator/getBy…`, no hard-coded text.**
5. Expected texts/attributes are passed in from JSON data.
6. Optional shared component class only when a block is used on ≥2 pages.

Skeleton (names are placeholders until Appendix A):
```ts
export class LoginPage extends BasePage {
  readonly form: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly registerLink: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.form = page.getByTestId('TBD');                 // else getByRole('form') / other stable
    this.emailInput = this.form.getByTestId('TBD');      // else getByLabel(...)
    this.passwordInput = this.form.getByTestId('TBD');
    this.submitButton = this.form.getByRole('button', { name: /TBD/ });
    this.registerLink = this.form.getByRole('link', { name: /TBD/ });
    this.errorMessage = page.getByTestId('TBD');
  }
  async open() { await this.goto('TBD-path'); }
  async login(u: { email: string; password: string }) { /* fill (password sensitive) + submit */ }
  async expectLoaded() { /* url + form visible */ }
  async expectFormElements(expected: LoginPageExpectations) { /* visibility, types, placeholders, toggle, links */ }
  async expectValidation(expected: ValidationExpectation) { /* native or rendered, per H4 */ }
  async expectLoginError(message: string | RegExp) { /* visible + text */ }
}
```

### 8.3 `test.step()` usage
Each logical stage in a spec is wrapped: `await test.step('Open the login page', async () => { … })`. Fixtures that run preconditions wrap them as `Precondition: …`. (The reference `BasePage.step()` adds finer-grained steps for individual actions — keep it; nested steps are fine in Allure.) Step titles are English, imperative, and never contain credentials.

### 8.4 Fixtures — `fixtures/index.ts`
`export const test = base.extend<Fixtures>({...})`; specs import `{ test }` only (no `expect`, to enforce rule 8.2-4).

| Fixture | Description |
|---------|-------------|
| `loginPage`, `registrationPage`, `landingPage` | Page objects built from the test's `page`. |
| `newUser` | `RegistrationData` generated, **not** registered. |
| `registeredUser` | Generated **and registered through the UI**, session reset, ready for login. Teardown: cleanup if supported (8.6). |

```ts
registeredUser: async ({ registrationPage, landingPage }, use) => {
  const user = generateRegistrationData();
  await test.step('Precondition: register a new user via UI', async () => {
    await registrationPage.open();
    await registrationPage.register(user);
    await registrationPage.expectRegistrationSucceeded();
    await landingPage.logoutIfLoggedIn();      // only if H2 (auto-login)
  });
  saveGeneratedUser(user);                      // helpers/userStore.ts
  await use(user);
  /* best-effort cleanup if H5 */
},
```
Session reset rule: **prefer UI logout**. If H1 is true, never clear browser storage (it would delete the registered user).

### 8.5 Global methods and test independence
- UI-common logic → `BasePage`. Non-UI utilities → `helpers/` (only `userStore.ts`, optionally `mailbox.ts`, `cleanup.ts`). Logging → `Logger`.
- Every test creates its own data and preconditions (fixtures); no test reads another test's data; safe under `fullyParallel`.

### 8.6 Cleanup and generated-credential storage
- **Cleanup:** only if H5 and permitted. Best-effort in fixture teardown; failure logs a warning and never fails the test. If H1 is true, the discarded browser context is the cleanup. If unsupported: documented no-op; generated emails start with `autotest.` for manual purge.
- **Secure storage for reuse (`helpers/userStore.ts`):** `saveGeneratedUser(user)` writes **one file per user** `.runtime/users/<id>.json` (no shared file → no race between workers), file mode `0o600` where supported, directory git-ignored, **never uploaded as a CI artifact, never logged/attached**. Enabled locally by default, **off in CI** (`STORE_GENERATED_USERS`). Tests **do not read** the store (keeps independence); it exists for manual debugging, re-login and later cleanup tooling. Only throw-away generated passwords are stored (A8). If real mailbox credentials are ever needed, they live in `.env.local` / GitHub Secrets, not here.

### 8.7 Real test mailbox and email verification (conditional on H3)
Default: not implemented. If email verification exists → **Stop S2**, ask the user for the provider, then add `helpers/mailbox.ts` (`waitForEmail`, `extractVerificationLink`) configured only via `MAIL_*` variables; generated addresses then use the mailbox domain.

---

## 9. Test Data
Static inputs and **expected results** → JSON; dynamic/unique data → `Data/generators.ts` only.

`Data/login.json` (structure; values from Appendix A):
```json
{
  "page": { "path": "TBD", "heading": "TBD", "fields": { "email": { "type": "TBD", "placeholder": "TBD" }, "password": { "type": "password", "placeholder": "TBD" } }, "links": [ { "name": "TBD", "href": "TBD" } ] },
  "unregisteredUser": { "email": "not.registered@example.com", "password": "Wrong#12345" },
  "validation": [
    { "case": "empty form", "email": "", "password": "", "expected": { "field": "email", "message": "TBD" } },
    { "case": "empty password", "email": "user@example.com", "password": "", "expected": { "field": "password", "message": "TBD" } },
    { "case": "invalid email format", "email": "plainstring", "password": "Any#12345", "expected": { "field": "email", "message": "TBD" } }
  ],
  "messages": { "invalidCredentials": "TBD" }
}
```
`Data/registration.json`: `page` (path, heading, fields), `passwordPolicy`, `validation[]` (`case`, `values`, `expected{field,message}`), `messages{success,duplicateEmail}`.

`Data/generators.ts`: adapted from the reference — first/last-name lists, `randomUUID` suffix, `autotest.` email prefix, domain from `getEmailDomain()`, password satisfying the recorded policy, `overrides`; exports `RegistrationData` and `generateRegistrationData()`.

Rules: no literals for inputs/expectations in specs or Page Objects; parametrised test titles use the JSON `case` label only (never emails/passwords — Slack shows titles, D3).

---

## 10. Test Case Specifications
Titles: `TC-0X: …` (naming only). Parametrised cases create **one test per JSON row**. Steps follow Section 8.3. Mirror the reference's coverage style: attribute checks (type, placeholder), password show/hide toggle (if present), link targets.

| TC | File | Scenario |
|----|------|----------|
| **TC-01** Login page: fields, visibility, validation | `login.spec.ts` | **A:** open login → `expectLoaded` → `expectFormElements` (heading, email, password masked, submit enabled, registration link, toggle, other links). **B (per JSON row):** submit invalid/empty values → `expectValidation(field, message)`; user stays on login page. **C:** registration link navigates to the registration page. |
| **TC-02** Login with unregistered user | `login.spec.ts` | Submit `unregisteredUser` → `expectLoginError(messages.invalidCredentials)` → still on login page, no logged-in indicator. Make sure the email cannot collide with seeded/demo users (H1). |
| **TC-03** Registration page: fields and visibility | `registration.spec.ts` | Open registration (direct URL **and** via login link) → `expectLoaded` → `expectFormElements` (all fields, masked password fields, submit button, link back to login) → back-to-login works. No submission. |
| **TC-04** Registration: functionality and validation | `registration.spec.ts` | **A:** `newUser` → fill + submit → `expectRegistrationSucceeded` (redirect/message per Appendix A). **B (per JSON row):** invalid values over a valid user → `expectValidation`; no account created. **C:** duplicate email (only if rejected by the app). **D:** password-confirmation mismatch (only if the field exists). If CAPTCHA blocks submission → **Stop S3**. |
| **TC-05** Login with registered user | `login.spec.ts` | `registeredUser` fixture → open login → login → `landingPage.expectLoggedIn(user)` (URL/heading/indicator, logout visible) → optionally logout back to login. |

---

## 11. Local Execution, Diagnostics, Reports

### 11.1 `allure-teardown.ts` (windowless report server)
Generates the report (`allure generate allure-results --clean -o allure-report`; binary `allure.cmd` on Windows, `allure` elsewhere) and serves it with `scripts/serve-report.cjs`, a plain detached node process started with `windowsHide`, instead of `allure open`: under Windows Terminal the chained console apps (`cmd → allure → java`) ignore `windowsHide` and leave a console window in the taskbar. The server listens on port 5050 (or the next free one) and writes `{ pid, port }` to `.runtime/allure-server.json`; the next run stops it (`taskkill /T` on Windows) before generating a fresh report, and the browser is opened with `cmd /c start` / `open` / `xdg-open`. `allure-setup.ts` wipes `allure-results` before every run. Both are registered in the config only when not `CI` and `NO_REPORT_OPEN` is unset (the setup runs always).

### 11.2 Execution matrix
| Setting | Local | CI |
|---------|-------|----|
| Browser | Chromium | Chromium |
| Workers | `WORKERS` (default Playwright) | **1** |
| Retries | **0** | **2** |
| Screenshot / trace / video | on failure | on failure |
| Playwright HTML | `npm run report:html` | artifact (+ Pages) |
| Allure | generated and opened automatically | generated in CI → artifact (+ Pages) |
| Slack | optional local reporter (D4) | consolidated report after every run |

---

## 12. CI/CD — `.github/workflows/playwright.yml`
Based on the reference workflow. Jobs: `ui` → `pages` (optional) → `notify` (always). One UI job (no API scope).

> The workflow file in the repo is the source of truth. Compared with the YAML below it also uploads the test tracker as artifact `neon-tracker`, copies `tracker-report` to the Pages site (`/tracker/`), and passes `tracker_url` / `pw_url` to the Slack job. The schedule is 00:07 `Europe/Kyiv` (see Section 17).

```yaml
name: Playwright Tests

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
    inputs:
      base_url:
        description: 'Override BASE_URL (optional)'
        required: false
        type: string
  schedule:
    - cron: '7 0 * * *'              # 00:07 Kyiv; avoid :00 (GitHub delays runs most at the start of every hour)
      timezone: 'Europe/Kyiv'

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  ui:
    name: UI tests (Chromium)
    runs-on: ubuntu-latest
    timeout-minutes: 60
    outputs:
      allure_html_url: ${{ steps.allure_html.outputs.artifact-url }}   # direct download link of the Allure HTML artifact
    env:
      CI: true
      BASE_URL: ${{ inputs.base_url || vars.BASE_URL }}   # empty → DEFAULT_BASE_URL from config/env.ts
      TEST_EMAIL_DOMAIN: ${{ vars.TEST_EMAIL_DOMAIN }}
      # MAIL_* secrets: add here ONLY if email verification is implemented (H3)
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: lts/*, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npx playwright install --with-deps chromium

      - name: Run Playwright tests
        run: npx playwright test

      - name: Generate Allure report          # Java is preinstalled on ubuntu-latest; add actions/setup-java only if missing
        if: ${{ !cancelled() }}
        run: npx allure generate allure-results --clean -o allure-report

      - name: Generate single-file Allure report (one HTML file, opens by double-click)
        if: ${{ !cancelled() }}
        # Allure 2 flag; agent must verify `--single-file` exists in the installed allure-commandline version (npx allure generate --help)
        run: npx allure generate allure-results --clean --single-file -o allure-report-single

      - name: Assemble reports site
        if: ${{ !cancelled() }}
        run: |
          mkdir -p site
          cp -r allure-report site/allure
          cp -r playwright-report site/playwright
          printf '<h1>FinMore test reports</h1><ul><li><a href="allure/">Allure Report</a></li><li><a href="playwright/">Playwright HTML Report</a></li></ul>' > site/index.html

      - { name: Upload Playwright report, if: '${{ !cancelled() }}', uses: actions/upload-artifact@v4, with: { name: playwright-report, path: playwright-report/, retention-days: 30, if-no-files-found: ignore } }
      - { name: Upload Allure report,     if: '${{ !cancelled() }}', uses: actions/upload-artifact@v4, with: { name: allure-report,     path: allure-report/,     retention-days: 30, if-no-files-found: ignore } }
      - name: Upload Allure HTML (single file, for direct download from Slack)
        id: allure_html
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with: { name: allure-report-html, path: allure-report-single/index.html, retention-days: 30, if-no-files-found: ignore }
      - { name: Upload Allure results,    if: '${{ !cancelled() }}', uses: actions/upload-artifact@v4, with: { name: allure-results,    path: allure-results/,    retention-days: 30, if-no-files-found: ignore } }
      - { name: Upload diagnostics,       if: '${{ !cancelled() }}', uses: actions/upload-artifact@v4, with: { name: test-results,       path: test-results/,       retention-days: 30, if-no-files-found: ignore } }
      - { name: Upload JSON summary,      if: '${{ !cancelled() }}', uses: actions/upload-artifact@v4, with: { name: playwright-summary, path: playwright-summary.json, retention-days: 30, if-no-files-found: ignore } }

      - name: Upload site for GitHub Pages
        if: ${{ !cancelled() && github.ref == 'refs/heads/main' && vars.PUBLISH_PAGES == 'true' }}
        uses: actions/upload-pages-artifact@v3
        with: { path: site }

  pages:
    needs: ui
    if: ${{ !cancelled() && needs.ui.result != 'skipped' && github.ref == 'refs/heads/main' && vars.PUBLISH_PAGES == 'true' }}
    runs-on: ubuntu-latest
    permissions: { pages: write, id-token: write }
    concurrency: { group: pages, cancel-in-progress: false }
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    outputs:
      page_url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4

  notify:
    needs: [ui, pages]
    if: ${{ !cancelled() }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: lts/* }
      - uses: actions/download-artifact@v4
        continue-on-error: true                      # missing if tests never ran
        with: { name: playwright-summary, path: . }
      - name: Notify Slack
        run: node .github/scripts/playwright-slack.cjs
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          JOB_STATUS: ${{ needs.ui.result }}
          PAGES_URL: ${{ needs.pages.outputs.page_url }}
          ALLURE_HTML_URL: ${{ needs.ui.outputs.allure_html_url }}
          EXTERNAL_PR: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository }}
```
Notes
- `!cancelled()` (reference style) makes `notify` run after failed runs too.
- If GitHub rejects the `timezone:` key for scheduled workflows in `<NEW_GITHUB_REPO>`, use the fallback: two crons (`0 15 * * *` and `0 16 * * *` UTC) plus a first `gate` job that proceeds only when `TZ=Europe/Kyiv date +%H` equals `18`.
- Never write secrets to logs; do not enable `ACTIONS_STEP_DEBUG` with secrets in scope.

**One-time setup done by the user (not the agent):** create `<NEW_GITHUB_REPO>`; add Secret `SLACK_WEBHOOK_URL`; optional Variables `BASE_URL`, `TEST_EMAIL_DOMAIN`; to publish reports: Settings → Pages → Source = **GitHub Actions**, then Variable `PUBLISH_PAGES=true` (Pages are public, A6; the Playwright report embeds failure traces with throw-away inputs, D1).

---

## 13. Slack — `.github/scripts/playwright-slack.cjs` (reuse + extend)
Start from the reference script (CommonJS, `buildMessage`, `escapeSlack`, `redirect:'error'`, 15 s timeout, no logging of errors/webhook, fork-PR skip) and change only:
1. **Status:** `JOB_STATUS === 'success'` → ✅ Passed (⚠️ "Passed with flaky" when `flaky > 0`), otherwise ❌ Failed (also when the JSON is missing).
2. **Failed tests:** in `visit()`, list `❌ <spec title> — <file>:<line>` (title = `[...describe titles, spec.title]` joined by ` › `), same for ⚠️ flaky; cap 15 each, then "…and N more". Titles are credential-free by rule (Section 9); `escapeSlack` still applies.
3. **Links** (one line, short labels): `Report` = `PAGES_URL + 'tracker/'` (test tracker), `Report Al` = `PAGES_URL + 'allure/'`, `Report PW` = `PAGES_URL + 'playwright/'` — they open straight in the browser and need GitHub Pages; without Pages the same labels point to the artifact zips (`TRACKER_URL`, `ALLURE_HTML_URL`, `PW_URL`) and read `(zip)`. `GitHub` = the Actions run URL.
4. **Context line:** repository, branch (`GITHUB_HEAD_REF || GITHUB_REF_NAME`), trigger + run number, `BASE_URL`.
5. Keep: Total · Passed · Failed · Flaky · Skipped, and `Duration:` as `15.1 s` under a minute, `3 m 47 s` from a minute up.
6. Missing webhook → throw (reference behaviour, D2) except `EXTERNAL_PR === 'true'`.
7. Still exports `buildMessage` so it can be unit-checked locally.

Never include errors, stack traces, emails, passwords or the webhook in the message.

---

## 14. README.md (content requirements)
1. Purpose and scope (5 TCs, UI only, Chromium).
2. Prerequisites: Node LTS, **Java** (Allure CLI 2; local), Windows/macOS notes.
3. Setup: `npm install`, `npx playwright install chromium`, copy `.env.example` → `.env.local`.
4. Environment variables table (7.2) and how to target another environment (`BASE_URL` in `.env.local` or in the shell; PowerShell vs bash syntax shown side by side).
5. Commands: `npm test`, single file/test, `WORKERS`, `NO_REPORT_OPEN`, `npm run typecheck`, `report:html`, `report:allure`.
6. Structure and architecture rules (Section 8) incl. "assertions only in Page Objects", locator priority, no duplicated locators, data in JSON, generated data via generator.
7. How to add a test / page object / data file (checklist).
8. Reports and diagnostics (HTML, Allure, trace viewer `npx playwright show-trace`), where CI artifacts and Pages links are.
9. CI: triggers (incl. the daily Europe/Kyiv schedule and its GitHub delay caveat), jobs, Secrets/Variables to configure, Pages caveats.
10. Slack: what the report contains; local reporter behaviour.
11. Security notes: no secrets in Git, throw-away generated users, traces contain typed inputs, `.runtime/` is local-only.
12. Limitations: no Allure trend history, cleanup limits (H1/H5), Chromium only.
13. Definition of Done (Section 16).

---

## 15. Verification Plan (agent runs and reports)

| # | Check | How | Expected |
|---|-------|-----|----------|
| V1 | Types | `npm run typecheck` | exit 0 |
| V2 | Full run | `npm test` | all TC pass; Allure opens automatically |
| V3 | No auto-open | set `NO_REPORT_OPEN=1` in the process environment (PowerShell: `$env:NO_REPORT_OPEN=1`), `npm test` | report not opened |
| V4 | CI settings | `CI=1 npx playwright test --list` (PowerShell: `$env:CI=1`) and inspect resolved config | workers 1, retries 2, `playwright-summary.json` configured |
| V5 | Flakiness | `npx playwright test --repeat-each=5` | 100 % pass |
| V6 | Parallel safety | `WORKERS=4` in the process environment (PowerShell: `$env:WORKERS=4`) | all pass |
| V7 | Diagnostics | temporarily break one locator, run, then revert | screenshot, `trace.zip`, video exist for the failed test and appear in both reports |
| V8 | Spec purity | search `tests/` for `expect(`, `getBy`, `locator(`, `@` literals, `password` literals | no matches |
| V9 | Locator uniqueness | review `pages/` | no element declared twice; priority respected |
| V10 | Masking | run with `LOG_LEVEL=DEBUG`, inspect console + Allure steps | no password values anywhere |
| V11 | Env override | `BASE_URL=<APP_URL>` and an invalid URL | picked up / fails clearly |
| V12 | Secrets hygiene | `git status` (if repo exists), search tracked files for webhook/password patterns | `.env.local`, `.runtime/` ignored; nothing sensitive |
| V13 | Cross-platform | review scripts for Windows-only/mac-only commands | none; `allure-teardown.ts` picks the right binary |
| V14 | Slack script | feed sample `playwright-summary.json` files (all pass / with failures / with flaky / missing) to `buildMessage` and print the result; send to a throw-away webhook only if the user provides one | correct counts, names, links; no secrets |
| V15 | Workflow | `actionlint` if available, otherwise careful manual review | valid syntax/expressions |
| V16 | Git policy | `git status` | nothing committed/pushed without approval |

Final report to the user: what was done, V1–V16 results, deviations (with reasons), items needing user action (repo, Secrets/Variables, Pages, filling `SLACK_WEBHOOK_URL` in `.env.local`), the Section 2.3 findings, and a suggested commit message.

---

## 16. Definition of Done
- [ ] Phase 0 done, Appendix A filled, Stop Conditions resolved with the user where hit.
- [ ] TC-01…TC-05 implemented; green locally and in CI; stable across `--repeat-each=5`.
- [ ] Locators, actions **and assertions** live in Page Objects; specs have no raw locators/`expect`.
- [ ] No duplicated locators; priority `getByTestId → getByRole → getByLabel → other` respected.
- [ ] `BasePage` present (justified), trimmed, with sensitive-value masking.
- [ ] Reusable fixtures; no copy-pasted logic; `test.step()` in specs/fixtures.
- [ ] Static data + expected results in JSON; dynamic data only via generator; titles credential-free.
- [ ] Multi-environment via `BASE_URL` (env / `.env.local` / CI variable / manual input).
- [ ] `.env.local` created from `.env.example` in Phase 1 and ignored by Git (the agent never writes secrets into it); `.env.example` committed (no BOM, no values), secrets only in GitHub Secrets; nothing sensitive in Git, reports or logs.
- [ ] Unique users registered via UI; generated users stored securely (local, per-file, ignored); cleanup implemented where supported, otherwise documented.
- [ ] Tests independent; Chromium default; local workers configurable, CI 1; retries local 0 / CI 2; no tags.
- [ ] Screenshots, traces, videos on failure.
- [ ] Allure generated and auto-opened locally (Windows + macOS); Allure + Playwright HTML uploaded as artifacts and published to Pages when permitted.
- [ ] Workflow with triggers: push `main`, PR, the daily `Europe/Kyiv` schedule (00:07), manual.
- [ ] Slack report after **every** CI run (incl. failures/no results): statistics, duration, failed test names, report links, **and a direct download link to a single-file Allure HTML report** (opens by double-click, no server needed).
- [ ] README complete; Verification Plan executed and reported.
- [ ] **Nothing committed, pushed or merged without user approval.**

---

## 17. Test tracker, evidence and reporting (added after hand-off)

- **Test tracker** — `reporters/neon-tracker.ts` writes a self-contained `tracker-report/index.html` (dark neon theme): PASS/FAIL/FLAKY per test, failures first, the exact failing step marked in the step timeline, spec and page-object line, a heuristic diagnosis (probable app bug / test issue / environment / flaky / check screenshot) with Expected vs Received and next steps, inline video, screenshots and trace with download buttons. The header shows the project link from `baseURL` and durations as `0.95 s` / `19.6 s` / `1 m 34 s`. Opened automatically after local runs (not on CI, not with `NO_REPORT_OPEN`; `npm run report:tracker` reopens it). On CI it is uploaded as artifact `neon-tracker` and copied to Pages (`/tracker/`). Output `tracker-report/` is git-ignored.
- **Evidence** — `fixtures/evidence.ts` (auto fixture) and `reporters/evidence-files.ts`: every UI test records a video (step captions and click highlights drawn into the page) and a final screenshot; failures add an annotated failure screenshot and a trace. The tracker converts WebM to MP4 (`@ffmpeg-installer/ffmpeg`) and publishes the latest evidence per spec into the git-ignored `evidence/<spec>/` folder (`<spec>.video.mp4` = all tests of the spec, `<spec>.tcN.screenshot.png`); a run replaces only the specs it executed. `npm run test:evidence` (`EVIDENCE_MODE=1`) adds a screenshot after every assertion, a 1440×900 video and a trace for every test. `BasePage.step()/click()/fill()` call the recorder; captions never show typed values.
- **Video speed** — pacing makes the video play at the speed of a quick user: pauses after steps (open 900 ms, click 500, fill 200, expect 250, other 150) and typing at 45 ms per character. `EVIDENCE_PACE=fast` halves the pauses, `off` disables pacing. The visibility pre-checks inside `click()` are not paced. Cost: a local run takes about 2 minutes instead of 20 seconds.
- **Slack** — one line of links (`Report`, `Report Al`, `Report PW`, `GitHub`) and the duration as `3 m 47 s` (Section 13). The links open in the browser only when GitHub Pages is on (`PUBLISH_PAGES=true` plus Settings → Pages → Source = GitHub Actions); otherwise they are zip artifacts labelled `(zip)`.
- **Pages are public and Playwright reports record typed values** (internal `fill` steps, traces), so anything published must come from throw-away data. Real accounts must never be used by tests or CI secrets (the premiereonline project had to replace one).
- **Schedule** — daily 00:07 `Europe/Kyiv`. The minute is deliberately not :00: GitHub delays scheduled runs most at the start of every hour (delays of hours were observed), so a run can start much later than configured.
- `--reporter=...` on the command line replaces the configured reporters (no Allure results, no tracker for such a run).
- The same tracker, evidence layer, Slack format and Pages setup are used in the premiereonline project.

---

## Appendix A — Discovery Results (Phase 0 completed 2026-11-24)

### A.1 General
| Item | Finding |
|------|---------|
| `<NEW_PROJECT_DIR>` state (empty? git?) | Contained only `IMPLEMENTATION_PLAN.md`; no `.git` → S6 not hit |
| UI language | Ukrainian |
| Routes (login / registration / landing); SPA deep links work? | **One URL `/`.** Login, registration and dashboard are state-driven views — **no deep links** (TC-03 "direct URL" is not applicable; registration is reached via the login page link). A page reload shows login if logged out, dashboard if logged in |
| Users stored in — H1 | **TRUE: browser `localStorage`** (`users`, `currentUser`). Two demo users are seeded on first load (`admin@demo.com`, `user@demo.com`; credentials are shown on the login page itself) → never clear storage inside a test; the discarded context is the cleanup |
| Auto-login after registration — H2 | **TRUE** → dashboard shown right after submit |
| Email verification — H3 | **FALSE** |
| Native vs custom validation — H4 | **Mixed.** Custom errors (`*-error` test ids) on submit; inputs are not `required`. `type=email` also triggers **native** HTML5 validation: a value without `@` (e.g. `plainstring`) is blocked by the browser (no app message, locale-dependent text); `a@b` passes native and gets the app message |
| Delete-account capability — H5 | Not needed/used (H1: context discarded) |
| `data-testid` coverage — H6 | **Full** on login, registration, dashboard shell, user menu. Labels are **not** bound to inputs (`getByLabel` unusable) |
| CAPTCHA / rate limits — H7 | None observed |
| Logout flow & logged-in indicator | `user-menu-trigger` (shows user name) → `logout-button` inside `user-menu-dropdown`. Logged-in: `dashboard-content`, `dashboard-title` = «Панель управління». **Quirk:** after logout the app returns to the *last auth view used* (registration view if the user registered in this page session) → use `loginPage.open()` (`goto('/')`) to reach login reliably |
| Password policy | Min 6 characters; confirmation must match; name min 2 characters |

### A.2 Login page (`login-page`)
| Element | Locator (strategy used) | Notes |
|---------|------------------------|-------|
| Form | `getByTestId('login-form')` | |
| Heading | `login-title` | «Вхід до системи»; subtitle «Увійдіть до свого облікового запису» |
| Email field | `login-email-input` | `type=email`, placeholder `your@email.com` |
| Password field | `login-password-input` | `type=password`, placeholder «Введіть пароль» |
| Show/hide toggle | `toggle-password-visibility` | `aria-label` "Show password" ⇄ "Hide password", input type password ⇄ text |
| Submit button | `login-submit-button` | «Увійти» |
| Link to registration | `switch-to-register-button` | a `button`, «Зареєструватися» |
| Error containers | `email-error`, `password-error`, `login-error` | appear only when there is an error |

### A.3 Registration page (`register-page`)
| Element | Locator | Notes |
|---------|---------|-------|
| Form / heading | `register-form` / `register-title` | «Реєстрація» |
| Name | `register-name-input` | text, placeholder «Іван Петренко» |
| Email | `register-email-input` | email, placeholder `your@email.com` |
| Password / toggle | `register-password-input` / `toggle-password-visibility` | placeholder «Мінімум 6 символів» |
| Confirmation / toggle | `register-confirm-password-input` / `toggle-confirm-password-visibility` | placeholder «Повторіть пароль» |
| Currency | `register-currency-select` | options UAH (default), USD, EUR, GBP (`currency-option-*`) |
| Submit | `register-submit-button` | «Зареєструватися» |
| Link back | `switch-to-login-button` | «Увійти» |
| Error containers | `name-error`, `email-error`, `password-error`, `confirm-password-error`, `register-error` | |
| Success indicator | `dashboard-content` + `user-menu-trigger` showing the name | |

### A.4 Validation matrix
| Page | Input case | Trigger | Expected message/state |
|------|-----------|---------|------------------------|
| Login | empty form | submit | `email-error` «Email обов'язковий», `password-error` «Пароль обов'язковий» |
| Login | empty password | submit | `password-error` «Пароль обов'язковий» |
| Login | empty email | submit | `email-error` «Email обов'язковий» |
| Login | invalid email `a@b` | submit | `email-error` «Невірний формат email» |
| Login | invalid email `plainstring` | submit | **native** `typeMismatch`, form not submitted, no app errors |
| Login | unregistered user | submit | `login-error` «Невірний email або пароль» (also for any wrong password) |
| Registration | empty form | submit | name «Ім'я обов'язкове», email «Email обов'язковий», password «Пароль обов'язковий», confirm «Підтвердження паролю обов'язкове» |
| Registration | name 1 char | submit | `name-error` «Ім'я повинно містити мінімум 2 символи» |
| Registration | invalid email `a@b` | submit | `email-error` «Невірний формат email» |
| Registration | weak password (5 chars) | submit | `password-error` «Пароль повинен містити мінімум 6 символів» |
| Registration | empty confirmation | submit | `confirm-password-error` «Підтвердження паролю обов'язкове» |
| Registration | confirmation mismatch | submit | `confirm-password-error` «Паролі не співпадають» |
| Registration | duplicate email (`user@demo.com`) | submit | `register-error` «Користувач з таким email вже існує» |

### A.5 Missing `data-testid` (request list for developers)
- `user-menu-dropdown` items are covered; no gaps found for in-scope pages.
- Minor: `app-title` test id is used twice on the dashboard (sidebar and header); the toggle test id `toggle-password-visibility` is reused on both login and registration (harmless, different views).
