import type { Page } from '@playwright/test';
import { ROUTES } from '../config/constants';
import { ToastPageObject } from './components/toast.po';

export class PricingPage {
  readonly toast: ToastPageObject;

  constructor(private page: Page) {
    this.toast = new ToastPageObject(page);
  }

  async goto() {
    await this.page.goto(ROUTES.pricing);
  }

  get toggleMonthly() {
    return this.page.locator('[data-testid="pricing-toggle-monthly"]');
  }

  get toggleYearly() {
    return this.page.locator('[data-testid="pricing-toggle-yearly"]');
  }

  get ctaFree() {
    return this.page.locator('[data-testid="cta-free"]');
  }

  get ctaPro() {
    return this.page.locator('[data-testid="cta-pro"]');
  }

  get yearlyBadge() {
    return this.page.getByText('Ahorra 8%');
  }

  async clickMonthly() {
    await this.toggleMonthly.click();
  }

  async clickYearly() {
    await this.toggleYearly.click();
  }

  async clickCtaFree() {
    await this.ctaFree.click();
  }

  async clickCtaPro() {
    await this.ctaPro.click();
  }
}
