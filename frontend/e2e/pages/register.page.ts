import type { Page } from '@playwright/test';
import { ROUTES } from '../config/constants';
import { ToastPageObject } from './components/toast.po';

export class RegisterPage {
  readonly toast: ToastPageObject;

  constructor(private page: Page) {
    this.toast = new ToastPageObject(page);
  }

  async goto(plan?: string) {
    const url = plan ? `${ROUTES.register}?plan=${plan}` : ROUTES.register;
    await this.page.goto(url);
  }

  async fillName(name: string) {
    await this.page.fill('#name', name);
  }

  async fillEmail(email: string) {
    await this.page.fill('#email', email);
  }

  async fillPassword(password: string) {
    await this.page.fill('#password', password);
  }

  async checkTerms() {
    await this.page.check('#accept-terms');
  }

  async checkPrivacy() {
    await this.page.check('#accept-privacy');
  }

  async clickSubmit() {
    await this.page.click('button[type="submit"]');
  }

  async register(name: string, email: string, password: string) {
    await this.fillName(name);
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.checkTerms();
    await this.checkPrivacy();
    await this.clickSubmit();
  }

  get passwordToggle() {
    return this.page.locator('[data-testid="password-toggle"]');
  }

  async togglePassword() {
    await this.passwordToggle.click();
  }
}
