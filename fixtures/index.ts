import { test as base } from '@playwright/test';
import dashboardData from '../Data/dashboard.json';
import { generateRegistrationData, type RegistrationData } from '../Data/generators';
import { saveGeneratedUser } from '../helpers/userStore';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { RegistrationPage } from '../pages/RegistrationPage';

interface Fixtures {
  loginPage: LoginPage;
  registrationPage: RegistrationPage;
  dashboardPage: DashboardPage;
  /** Generated unique user data, NOT registered in the app. */
  newUser: RegistrationData;
  /** Generated user registered through the UI in this test's own browser context, logged out, ready to log in. */
  registeredUser: RegistrationData;
}

// Specs import `{ test }` only (no `expect`): all assertions live in Page Objects.
export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  registrationPage: async ({ page }, use) => {
    await use(new RegistrationPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  newUser: async ({}, use) => {
    await use(generateRegistrationData());
  },

  // The app keeps its users in browser storage (per context), so the user is registered inside this
  // test's context and the discarded context is the cleanup: nothing to delete afterwards.
  registeredUser: async ({ newUser, loginPage, registrationPage, dashboardPage }, use) => {
    await base.step('Precondition: register a new user via UI', async () => {
      await loginPage.open();
      await loginPage.openRegistration();
      await registrationPage.expectLoaded();
      await registrationPage.register(newUser);
      await dashboardPage.expectLoggedIn(newUser, dashboardData.title); // registration logs the user in
      await dashboardPage.logout();
      await loginPage.open(); // the app returns to the last used auth view; the root URL always shows login
      await loginPage.expectLoaded();
    });
    saveGeneratedUser(newUser);
    await use(newUser);
  },
});
