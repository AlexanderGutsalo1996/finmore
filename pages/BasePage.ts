import { Page, Locator, expect, test } from '@playwright/test';
import { Logger } from '../config/Logger';

// Allows expected values to be either text or a regular expression.
type Matcher = string | RegExp;

// Sensitive values (passwords) are never printed to logs, Playwright steps or Allure.
interface SensitiveOptions {
    sensitive?: boolean;
}

// Stores the browser page and creates a logger for each Page Object.
export abstract class BasePage {
    readonly page: Page;
    protected readonly logger: Logger;

    protected constructor(page: Page) {
        this.page = page;
        this.logger = new Logger(new.target.name);
    }

    // ───────────────────────── Core ─────────────────────────

    /**
     * Wraps any action: logs start, adds a step to the Playwright report,
     * logs failure with the reason and re-throws the error.
     */
    protected async step<T>(message: string, action: () => Promise<T>): Promise<T> {
        this.logger.info(message);

        try {
            return await test.step(message, action);
        } catch (error) {
            const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
            this.logger.error(`${message} -> FAILED: ${reason}`);
            throw error;
        }
    }

    // Returns a custom element name or the locator description for logging.
    protected label(locator: Locator, name?: string): string {
        return name ?? locator.toString();
    }

    // Shows a value in logs, or a mask for sensitive values.
    private show(value: Matcher, opts?: SensitiveOptions): string {
        return opts?.sensitive ? '***' : String(value);
    }

    // ───────────────────────── Actions ─────────────────────────

    // Opens the specified URL (relative to baseURL) in the browser.
    async goto(url: string): Promise<void> {
        await this.step(`Open URL: ${url}`, () => this.page.goto(url).then(() => undefined));
    }

    // Verifies that an element is visible and enabled, then clicks it.
    async click(locator: Locator, name?: string): Promise<void> {
        await this.expectVisible(locator, name);
        await this.expectEnabled(locator, name);
        await this.step(`Click: ${this.label(locator, name)}`, () => locator.click());
    }

    // Replaces the content of an input field. Pass { sensitive: true } for passwords.
    async fill(locator: Locator, value: string, name?: string, opts?: SensitiveOptions): Promise<void> {
        // Note: Playwright's own HTML report/trace still record the typed value in the internal `locator.fill`
        // step, so only ever type throw-away values (the Allure report hides internal steps, see config).
        await this.step(`Fill "${this.show(value, opts)}" into: ${this.label(locator, name)}`, () =>
            locator.fill(value)
        );
    }

    // Selects a dropdown option by its value.
    async selectOption(locator: Locator, value: string, name?: string): Promise<void> {
        await this.step(`Select "${value}" in: ${this.label(locator, name)}`, () =>
            locator.selectOption(value).then(() => undefined)
        );
    }

    // ───────────────────────── Assertions ─────────────────────────

    // Verifies the browser page title.
    async expectTitle(title: Matcher): Promise<void> {
        await this.step(`Expect page title: ${title}`, () => expect(this.page).toHaveTitle(title));
    }

    // Verifies the current page URL.
    async expectUrl(url: Matcher): Promise<void> {
        await this.step(`Expect page URL: ${url}`, () => expect(this.page).toHaveURL(url));
    }

    // Verifies that an element is visible.
    async expectVisible(locator: Locator, name?: string): Promise<void> {
        await this.step(`Expect visible: ${this.label(locator, name)}`, () =>
            expect(locator).toBeVisible()
        );
    }

    // Verifies that an element is hidden (or absent from the DOM).
    async expectHidden(locator: Locator, name?: string): Promise<void> {
        await this.step(`Expect hidden: ${this.label(locator, name)}`, () =>
            expect(locator).toBeHidden()
        );
    }

    // Verifies that an element is enabled.
    async expectEnabled(locator: Locator, name?: string): Promise<void> {
        await this.step(`Expect enabled: ${this.label(locator, name)}`, () =>
            expect(locator).toBeEnabled()
        );
    }

    // Verifies the element's text.
    async expectText(locator: Locator, text: Matcher, name?: string): Promise<void> {
        await this.step(`Expect text ${text} in: ${this.label(locator, name)}`, () =>
            expect(locator).toHaveText(text)
        );
    }

    // Verifies the current value of an input. Pass { sensitive: true } to mask it in step titles.
    async expectValue(locator: Locator, value: Matcher, name?: string, opts?: SensitiveOptions): Promise<void> {
        await this.step(`Expect value ${this.show(value, opts)} in: ${this.label(locator, name)}`, () =>
            expect(locator).toHaveValue(value)
        );
    }

    // Verifies an HTML attribute value.
    async expectAttribute(locator: Locator, attribute: string, value: Matcher, name?: string): Promise<void> {
        await this.step(
            `Expect attribute "${attribute}" = ${value} on: ${this.label(locator, name)}`,
            () => expect(locator).toHaveAttribute(attribute, value)
        );
    }

    // Verifies the number of matching elements.
    async expectCount(locator: Locator, expected: number, name?: string): Promise<void> {
        await this.step(`Expect count ${expected} of: ${this.label(locator, name)}`, () =>
            expect(locator).toHaveCount(expected)
        );
    }

    // Verifies that the browser's native (HTML5) validation rejects the input.
    async expectNativelyInvalid(locator: Locator, name?: string): Promise<void> {
        await this.step(`Expect native validation error on: ${this.label(locator, name)}`, () =>
            expect
                .poll(() => locator.evaluate((el) => !(el as HTMLInputElement).validity.valid))
                .toBe(true)
        );
    }
}
