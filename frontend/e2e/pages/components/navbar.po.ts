import type { Page, Locator } from '@playwright/test';

export class NavbarPageObject {
  constructor(private page: Page) {}

  get navbar(): Locator {
    return this.page.locator('[data-testid="navbar"]');
  }

  get logoutButton(): Locator {
    return this.page.locator('[data-testid="logout-button"]');
  }

  get dashboardLink(): Locator {
    return this.page.locator('[data-testid="dashboard-link"]');
  }

  async clickLogout(): Promise<void> {
    await this.logoutButton.click();
  }

  async isAuthenticated(): Promise<boolean> {
    return this.logoutButton.isVisible();
  }
}
