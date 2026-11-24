import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

// Post-login landing page (dashboard) and the user menu with the logout action.
export class DashboardPage extends BasePage {
  readonly root: Locator;
  readonly heading: Locator;
  readonly userMenuTrigger: Locator;
  readonly userMenu: Locator;
  readonly userName: Locator;
  readonly userEmail: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    super(page);
    this.root = page.getByTestId('dashboard-content');
    this.heading = page.getByTestId('dashboard-title');
    this.userMenuTrigger = page.getByTestId('user-menu-trigger');
    this.userMenu = page.getByTestId('user-menu-dropdown');
    this.userName = this.userMenu.getByTestId('user-name');
    this.userEmail = this.userMenu.getByTestId('user-email');
    this.logoutButton = this.userMenu.getByTestId('logout-button');
  }

  async openUserMenu(): Promise<void> {
    await this.click(this.userMenuTrigger, 'User menu');
  }

  // Logs out through the UI (never by clearing storage: the app keeps its users there).
  async logout(): Promise<void> {
    if (!(await this.logoutButton.isVisible())) {
      await this.openUserMenu();
    }
    await this.click(this.logoutButton, 'Logout button');
  }

  async expectLoggedIn(user: { name: string }, expectedTitle: string): Promise<void> {
    await this.expectVisible(this.root, 'Dashboard');
    await this.expectText(this.heading, expectedTitle, 'Dashboard heading');
    await this.expectText(this.userMenuTrigger, user.name, 'User menu');
  }

  // Opens the user menu and verifies it shows the user's details and the logout action.
  async expectUserMenu(user: { name: string; email: string }): Promise<void> {
    await this.openUserMenu();
    await this.expectText(this.userName, user.name, 'User name');
    await this.expectText(this.userEmail, user.email, 'User email');
    await this.expectVisible(this.logoutButton, 'Logout button');
  }

  async expectNotLoggedIn(): Promise<void> {
    await this.expectHidden(this.root, 'Dashboard');
    await this.expectHidden(this.userMenuTrigger, 'User menu');
  }
}
