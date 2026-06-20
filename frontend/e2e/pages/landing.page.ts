import type { Page } from '@playwright/test';
import { ROUTES } from '../config/constants';

export class LandingPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(ROUTES.landing);
  }

  get heroTitle() {
    return this.page.locator('h1').first();
  }

  async getNavbar() {
    return this.page.locator('[data-testid="navbar"]');
  }
}
