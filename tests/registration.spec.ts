import dashboardData from '../Data/dashboard.json';
import { generateRegistrationData, type RegistrationData } from '../Data/generators';
import registrationData from '../Data/registration.json';
import { test } from '../fixtures';
import type { RegistrationValidationExpectation } from '../pages/RegistrationPage';

interface RegistrationValidationCase {
  case: string;
  values: Partial<RegistrationData>;
  expected: RegistrationValidationExpectation;
}

test.describe('TC-03: Registration page — fields and visibility', () => {
  // The stand is a single-URL SPA without deep links, so the page is reached only via the login page link.
  test.beforeEach(async ({ loginPage, registrationPage }) => {
    await test.step('Open the registration page via the login page link', async () => {
      await loginPage.open();
      await loginPage.openRegistration();
      await registrationPage.expectLoaded();
    });
  });

  test('TC-03: form elements are displayed', async ({ registrationPage }) => {
    await test.step('Check heading, fields, button and links', async () => {
      await registrationPage.expectFormElements(registrationData.page);
    });
    await test.step('Reveal and hide the password', async () => {
      await registrationPage.togglePasswordVisibility();
      await registrationPage.expectPasswordRevealed(true, registrationData.page);
      await registrationPage.togglePasswordVisibility();
      await registrationPage.expectPasswordRevealed(false, registrationData.page);
    });
    await test.step('Reveal and hide the password confirmation', async () => {
      await registrationPage.toggleConfirmPasswordVisibility();
      await registrationPage.expectConfirmPasswordRevealed(true, registrationData.page);
      await registrationPage.toggleConfirmPasswordVisibility();
      await registrationPage.expectConfirmPasswordRevealed(false, registrationData.page);
    });
  });

  test('TC-03: link back to the login page works', async ({ registrationPage, loginPage }) => {
    await test.step('Click the login link', async () => {
      await registrationPage.openLogin();
    });
    await test.step('Check the login page is shown', async () => {
      await loginPage.expectLoaded();
    });
  });
});

test.describe('TC-04: Registration — functionality and validation', () => {
  test.beforeEach(async ({ loginPage, registrationPage }) => {
    await test.step('Open the registration page', async () => {
      await loginPage.open();
      await loginPage.openRegistration();
      await registrationPage.expectLoaded();
    });
  });

  test('TC-04A: a new user registers successfully', async ({ newUser, registrationPage, dashboardPage }) => {
    await test.step('Submit the form with valid unique data', async () => {
      await registrationPage.register(newUser);
    });
    await test.step('Check the user is registered and logged in', async () => {
      await dashboardPage.expectLoggedIn(newUser, dashboardData.title);
      await dashboardPage.expectUserMenu(newUser);
    });
  });

  const validationCases: RegistrationValidationCase[] = registrationData.validation;
  for (const row of validationCases) {
    test(`TC-04B: validation — ${row.case}`, async ({ registrationPage, dashboardPage }) => {
      await test.step('Submit the form with the case values over valid data', async () => {
        await registrationPage.register(generateRegistrationData(row.values));
      });
      await test.step('Check the validation result and that no account was created', async () => {
        await registrationPage.expectValidation(row.expected);
        await registrationPage.expectLoaded();
        await dashboardPage.expectNotLoggedIn();
      });
    });
  }

  test('TC-04C: an already registered email is rejected', async ({ registrationPage, dashboardPage }) => {
    await test.step('Submit valid data with the email of an existing user', async () => {
      await registrationPage.register(generateRegistrationData({ email: registrationData.existingUser.email }));
    });
    await test.step('Check the duplicate-email error', async () => {
      await registrationPage.expectValidation({ errors: { general: registrationData.messages.duplicateEmail } });
      await dashboardPage.expectNotLoggedIn();
    });
  });
});
