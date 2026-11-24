import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginPageExpectations {
  title: string;
  heading: string;
  email: { type: string; placeholder: string };
  password: { type: string; placeholder: string };
  passwordToggle: { labelWhenHidden: string; labelWhenShown: string };
  submitText: string;
  registerLinkText: string;
}

export type LoginErrorField = 'email' | 'password' | 'general';

export interface LoginValidationExpectation {
  // Fields that must show exactly this message; every other error container must be absent.
  errors: Partial<Record<LoginErrorField, string>>;
  // The browser's own HTML5 validation blocks the submit (no app message).
  nativeEmailInvalid?: boolean;
}

export class LoginPage extends BasePage {
  readonly root: Locator;
  readonly heading: Locator;
  readonly form: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly passwordToggle: Locator;
  readonly submitButton: Locator;
  readonly registerLink: Locator;
  readonly errors: Record<LoginErrorField, Locator>;

  constructor(page: Page) {
    super(page);
    this.root = page.getByTestId('login-page');
    this.heading = page.getByTestId('login-title');
    this.form = page.getByTestId('login-form');
    this.emailInput = this.form.getByTestId('login-email-input');
    this.passwordInput = this.form.getByTestId('login-password-input');
    this.passwordToggle = this.form.getByTestId('toggle-password-visibility');
    this.submitButton = this.form.getByTestId('login-submit-button');
    this.registerLink = page.getByTestId('switch-to-register-button');
    this.errors = {
      email: page.getByTestId('email-error'),
      password: page.getByTestId('password-error'),
      general: page.getByTestId('login-error'),
    };
  }

  // The stand is a single-URL SPA (no deep links); the root URL shows login for a logged-out user.
  async open(): Promise<void> {
    await this.goto('/');
  }

  async openRegistration(): Promise<void> {
    await this.click(this.registerLink, 'Registration link');
  }

  // Types the credentials and submits the form (also used for invalid/empty values).
  async login(credentials: LoginCredentials): Promise<void> {
    await this.fill(this.emailInput, credentials.email, 'Email');
    await this.fill(this.passwordInput, credentials.password, 'Password', { sensitive: true });
    await this.click(this.submitButton, 'Login button');
  }

  async togglePasswordVisibility(): Promise<void> {
    await this.click(this.passwordToggle, 'Password visibility toggle');
  }

  async expectLoaded(): Promise<void> {
    await this.expectVisible(this.root, 'Login page');
    await this.expectVisible(this.form, 'Login form');
  }

  async expectFormElements(expected: LoginPageExpectations): Promise<void> {
    await this.expectTitle(expected.title);
    await this.expectText(this.heading, expected.heading, 'Login heading');

    await this.expectVisible(this.emailInput, 'Email');
    await this.expectAttribute(this.emailInput, 'type', expected.email.type, 'Email');
    await this.expectAttribute(this.emailInput, 'placeholder', expected.email.placeholder, 'Email');

    await this.expectVisible(this.passwordInput, 'Password');
    await this.expectAttribute(this.passwordInput, 'type', expected.password.type, 'Password');
    await this.expectAttribute(this.passwordInput, 'placeholder', expected.password.placeholder, 'Password');
    await this.expectVisible(this.passwordToggle, 'Password visibility toggle');
    await this.expectAttribute(this.passwordToggle, 'aria-label', expected.passwordToggle.labelWhenHidden, 'Password visibility toggle');

    await this.expectVisible(this.submitButton, 'Login button');
    await this.expectEnabled(this.submitButton, 'Login button');
    await this.expectText(this.submitButton, expected.submitText, 'Login button');

    await this.expectVisible(this.registerLink, 'Registration link');
    await this.expectText(this.registerLink, expected.registerLinkText, 'Registration link');
  }

  // Password is masked (type=password) or revealed (type=text), with the matching toggle label.
  async expectPasswordRevealed(revealed: boolean, expected: LoginPageExpectations): Promise<void> {
    await this.expectAttribute(
      this.passwordInput,
      'type',
      revealed ? 'text' : expected.password.type,
      'Password'
    );
    await this.expectAttribute(
      this.passwordToggle,
      'aria-label',
      revealed ? expected.passwordToggle.labelWhenShown : expected.passwordToggle.labelWhenHidden,
      'Password visibility toggle'
    );
  }

  async expectValidation(expected: LoginValidationExpectation): Promise<void> {
    for (const field of Object.keys(this.errors) as LoginErrorField[]) {
      const message = expected.errors[field];
      if (message === undefined) {
        await this.expectHidden(this.errors[field], `${field} error`);
      } else {
        await this.expectText(this.errors[field], message, `${field} error`);
      }
    }
    if (expected.nativeEmailInvalid) {
      await this.expectNativelyInvalid(this.emailInput, 'Email');
    }
  }

  async expectLoginError(message: string): Promise<void> {
    await this.expectText(this.errors.general, message, 'Login error');
  }
}
