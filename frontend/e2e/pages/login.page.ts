import type { Page } from '@playwright/test';
import { ROUTES } from '../config/constants';
import { ToastPageObject } from './components/toast.po';

export class LoginPage {
  readonly toast: ToastPageObject;

  constructor(private page: Page) {
    this.toast = new ToastPageObject(page);
  }

  async goto(redirect?: string) {
    const url = redirect ? `${ROUTES.login}?redirect=${encodeURIComponent(redirect)}` : ROUTES.login;
    await this.page.goto(url);
  }

  async fillEmail(email: string) {
    await this.page.fill('#email', email);
  }

  async fillPassword(password: string) {
    await this.page.fill('#password', password);
  }

  async clickSubmit() {
    await this.page.click('button[type="submit"]');
  }

  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSubmit();
  }

  get passwordToggle() {
    return this.page.locator('[data-testid="password-toggle"]');
  }

  async togglePassword() {
    await this.passwordToggle.click();
  }
}
