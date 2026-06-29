import type { Page } from '@playwright/test';
import { ROUTES } from '../config/constants';
import { ToastPageObject } from './components/toast.po';

export class ResetPasswordPage {
  readonly toast: ToastPageObject;

  constructor(private page: Page) {
    this.toast = new ToastPageObject(page);
  }

  async goto(token?: string) {
    const url = token ? `${ROUTES.resetPassword}?token=${token}` : ROUTES.resetPassword;
    await this.page.goto(url);
  }

  async fillPassword(password: string) {
    await this.page.fill('#password', password);
  }

  async fillConfirmPassword(password: string) {
    await this.page.fill('#confirmPassword', password);
  }

  async clickSubmit() {
    await this.page.click('button[type="submit"]');
  }

  get passwordToggle() {
    return this.page.locator('[data-testid="password-toggle"]').first();
  }

  get successMessage() {
    return this.page.getByRole('heading', { name: 'Contraseña actualizada' });
  }
}
