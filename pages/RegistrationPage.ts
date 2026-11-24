import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { RegistrationData } from '../Data/generators';

export interface RegistrationPageExpectations {
  title: string;
  heading: string;
  name: { type: string; placeholder: string };
  email: { type: string; placeholder: string };
  password: { type: string; placeholder: string };
  confirmPassword: { type: string; placeholder: string };
  passwordToggle: { labelWhenHidden: string; labelWhenShown: string };
  currency: { default: string; options: string[] };
  submitText: string;
  loginLinkText: string;
}

export type RegistrationErrorField = 'name' | 'email' | 'password' | 'confirmPassword' | 'general';

export interface RegistrationValidationExpectation {
  // Fields that must show exactly this message; every other error container must be absent.
  errors: Partial<Record<RegistrationErrorField, string>>;
}

export class RegistrationPage extends BasePage {
  readonly root: Locator;
  readonly heading: Locator;
  readonly form: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly passwordToggle: Locator;
  readonly confirmPasswordInput: Locator;
  readonly confirmPasswordToggle: Locator;
  readonly currencySelect: Locator;
  readonly currencyOptions: Locator;
  readonly submitButton: Locator;
  readonly loginLink: Locator;
  readonly errors: Record<RegistrationErrorField, Locator>;

  constructor(page: Page) {
    super(page);
    this.root = page.getByTestId('register-page');
    this.heading = page.getByTestId('register-title');
    this.form = page.getByTestId('register-form');
    this.nameInput = this.form.getByTestId('register-name-input');
    this.emailInput = this.form.getByTestId('register-email-input');
    this.passwordInput = this.form.getByTestId('register-password-input');
    this.passwordToggle = this.form.getByTestId('toggle-password-visibility');
    this.confirmPasswordInput = this.form.getByTestId('register-confirm-password-input');
    this.confirmPasswordToggle = this.form.getByTestId('toggle-confirm-password-visibility');
    this.currencySelect = this.form.getByTestId('register-currency-select');
    this.currencyOptions = this.currencySelect.getByRole('option');
    this.submitButton = this.form.getByTestId('register-submit-button');
    this.loginLink = page.getByTestId('switch-to-login-button');
    this.errors = {
      name: page.getByTestId('name-error'),
      email: page.getByTestId('email-error'),
      password: page.getByTestId('password-error'),
      confirmPassword: page.getByTestId('confirm-password-error'),
      general: page.getByTestId('register-error'),
    };
  }

  // One option of the currency dropdown (parameterised test id: `currency-option-<CODE>`).
  currencyOption(code: string): Locator {
    return this.currencySelect.getByTestId(`currency-option-${code}`);
  }

  // Types the data and submits the form (also used for invalid/empty values).
  async register(user: RegistrationData): Promise<void> {
    await this.fill(this.nameInput, user.name, 'Full name');
    await this.fill(this.emailInput, user.email, 'Email');
    await this.fill(this.passwordInput, user.password, 'Password', { sensitive: true });
    await this.fill(this.confirmPasswordInput, user.confirmPassword, 'Password confirmation', { sensitive: true });
    await this.selectOption(this.currencySelect, user.currency, 'Currency');
    await this.click(this.submitButton, 'Register button');
  }

  async openLogin(): Promise<void> {
    await this.click(this.loginLink, 'Login link');
  }

  async togglePasswordVisibility(): Promise<void> {
    await this.click(this.passwordToggle, 'Password visibility toggle');
  }

  async toggleConfirmPasswordVisibility(): Promise<void> {
    await this.click(this.confirmPasswordToggle, 'Confirmation visibility toggle');
  }

  async expectLoaded(): Promise<void> {
    await this.expectVisible(this.root, 'Registration page');
    await this.expectVisible(this.form, 'Registration form');
  }

  async expectFormElements(expected: RegistrationPageExpectations): Promise<void> {
    await this.expectTitle(expected.title);
    await this.expectText(this.heading, expected.heading, 'Registration heading');

    await this.expectVisible(this.nameInput, 'Full name');
    await this.expectAttribute(this.nameInput, 'type', expected.name.type, 'Full name');
    await this.expectAttribute(this.nameInput, 'placeholder', expected.name.placeholder, 'Full name');

    await this.expectVisible(this.emailInput, 'Email');
    await this.expectAttribute(this.emailInput, 'type', expected.email.type, 'Email');
    await this.expectAttribute(this.emailInput, 'placeholder', expected.email.placeholder, 'Email');

    await this.expectVisible(this.passwordInput, 'Password');
    await this.expectAttribute(this.passwordInput, 'type', expected.password.type, 'Password');
    await this.expectAttribute(this.passwordInput, 'placeholder', expected.password.placeholder, 'Password');
    await this.expectVisible(this.passwordToggle, 'Password visibility toggle');
    await this.expectAttribute(this.passwordToggle, 'aria-label', expected.passwordToggle.labelWhenHidden, 'Password visibility toggle');

    await this.expectVisible(this.confirmPasswordInput, 'Password confirmation');
    await this.expectAttribute(this.confirmPasswordInput, 'type', expected.confirmPassword.type, 'Password confirmation');
    await this.expectAttribute(this.confirmPasswordInput, 'placeholder', expected.confirmPassword.placeholder, 'Password confirmation');
    await this.expectVisible(this.confirmPasswordToggle, 'Confirmation visibility toggle');
    await this.expectAttribute(this.confirmPasswordToggle, 'aria-label', expected.passwordToggle.labelWhenHidden, 'Confirmation visibility toggle');

    await this.expectVisible(this.currencySelect, 'Currency');
    await this.expectValue(this.currencySelect, expected.currency.default, 'Currency');
    await this.expectCount(this.currencyOptions, expected.currency.options.length, 'Currency options');
    for (const code of expected.currency.options) {
      await this.expectAttribute(this.currencyOption(code), 'value', code, `Currency option ${code}`);
    }

    await this.expectVisible(this.submitButton, 'Register button');
    await this.expectEnabled(this.submitButton, 'Register button');
    await this.expectText(this.submitButton, expected.submitText, 'Register button');

    await this.expectVisible(this.loginLink, 'Login link');
    await this.expectText(this.loginLink, expected.loginLinkText, 'Login link');
  }

  // Password fields are masked (type=password) or revealed (type=text), with the matching toggle label.
  async expectPasswordRevealed(revealed: boolean, expected: RegistrationPageExpectations): Promise<void> {
    await this.expectAttribute(this.passwordInput, 'type', revealed ? 'text' : expected.password.type, 'Password');
    await this.expectAttribute(
      this.passwordToggle,
      'aria-label',
      revealed ? expected.passwordToggle.labelWhenShown : expected.passwordToggle.labelWhenHidden,
      'Password visibility toggle'
    );
  }

  async expectConfirmPasswordRevealed(revealed: boolean, expected: RegistrationPageExpectations): Promise<void> {
    await this.expectAttribute(
      this.confirmPasswordInput,
      'type',
      revealed ? 'text' : expected.confirmPassword.type,
      'Password confirmation'
    );
    await this.expectAttribute(
      this.confirmPasswordToggle,
      'aria-label',
      revealed ? expected.passwordToggle.labelWhenShown : expected.passwordToggle.labelWhenHidden,
      'Confirmation visibility toggle'
    );
  }

  async expectValidation(expected: RegistrationValidationExpectation): Promise<void> {
    for (const field of Object.keys(this.errors) as RegistrationErrorField[]) {
      const message = expected.errors[field];
      if (message === undefined) {
        await this.expectHidden(this.errors[field], `${field} error`);
      } else {
        await this.expectText(this.errors[field], message, `${field} error`);
      }
    }
  }

  async expectRegistrationError(message: string): Promise<void> {
    await this.expectText(this.errors.general, message, 'Registration error');
  }
}
