import dashboardData from '../Data/dashboard.json';
import loginData from '../Data/login.json';
import { test } from '../fixtures';
import type { LoginValidationExpectation } from '../pages/LoginPage';

interface LoginValidationCase {
  case: string;
  email: string;
  password: string;
  expected: LoginValidationExpectation;
}

test.describe('TC-01: Login page — fields, visibility, validation', () => {
  test.beforeEach(async ({ loginPage }) => {
    await test.step('Open the login page', async () => {
      await loginPage.open();
      await loginPage.expectLoaded();
    });
  });

  test('TC-01A: form elements are displayed', async ({ loginPage }) => {
    await test.step('Check heading, fields, button and links', async () => {
      await loginPage.expectFormElements(loginData.page);
    });
    await test.step('Reveal and hide the password', async () => {
      await loginPage.togglePasswordVisibility();
      await loginPage.expectPasswordRevealed(true, loginData.page);
      await loginPage.togglePasswordVisibility();
      await loginPage.expectPasswordRevealed(false, loginData.page);
    });
  });

  const validationCases: LoginValidationCase[] = loginData.validation;
  for (const row of validationCases) {
    test(`TC-01B: validation — ${row.case}`, async ({ loginPage, dashboardPage }) => {
      await test.step('Submit the form with the case values', async () => {
        await loginPage.login(row);
      });
      await test.step('Check the validation result', async () => {
        await loginPage.expectValidation(row.expected);
        await loginPage.expectLoaded();
        await dashboardPage.expectNotLoggedIn();
      });
    });
  }

  test('TC-01C: registration link opens the registration page', async ({ loginPage, registrationPage }) => {
    await test.step('Click the registration link', async () => {
      await loginPage.openRegistration();
    });
    await test.step('Check the registration page is shown', async () => {
      await registrationPage.expectLoaded();
    });
  });
});

test.describe('TC-02: Login with an unregistered user', () => {
  test('TC-02: unregistered user cannot log in', async ({ loginPage, dashboardPage }) => {
    await test.step('Open the login page', async () => {
      await loginPage.open();
      await loginPage.expectLoaded();
    });
    await test.step('Submit credentials of an unregistered user', async () => {
      await loginPage.login(loginData.unregisteredUser);
    });
    await test.step('Check the error and that the user stays logged out', async () => {
      await loginPage.expectLoginError(loginData.messages.invalidCredentials);
      await loginPage.expectLoaded();
      await dashboardPage.expectNotLoggedIn();
    });
  });
});

test.describe('TC-05: Login with a registered user', () => {
  test('TC-05: registered user logs in and out', async ({ registeredUser, loginPage, dashboardPage }) => {
    await test.step('Log in as the registered user', async () => {
      await loginPage.login(registeredUser);
    });
    await test.step('Check the user is logged in', async () => {
      await dashboardPage.expectLoggedIn(registeredUser, dashboardData.title);
      await dashboardPage.expectUserMenu(registeredUser);
    });
    await test.step('Log out and check the login page is shown', async () => {
      await dashboardPage.logout();
      await dashboardPage.expectNotLoggedIn();
    });
  });
});
