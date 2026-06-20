import type { Page } from '@playwright/test';
import { ROUTES } from '../config/constants';
import { ToastPageObject } from './components/toast.po';

export class ForgotPasswordPage {
  readonly toast: ToastPageObject;

  constructor(private page: Page) {
    this.toast = new ToastPageObject(page);
  }

  async goto() {
    await this.page.goto(ROUTES.forgotPassword);
  }

  async fillEmail(email: string) {
    await this.page.fill('#email', email);
  }

  async clickSubmit() {
    await this.page.click('button[type="submit"]');
  }

  get successMessage() {
    return this.page.getByText('Revisa tu bandeja de entrada');
  }
}
