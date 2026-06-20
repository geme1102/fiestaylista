import type { Page } from '@playwright/test';
import { ROUTES } from '../config/constants';
import { ToastPageObject } from './components/toast.po';

export class AccountPage {
  readonly toast: ToastPageObject;

  constructor(private page: Page) {
    this.toast = new ToastPageObject(page);
  }

  async goto() {
    await this.page.goto(ROUTES.account);
  }

  get cancelSubscriptionButton() {
    return this.page.locator('[data-testid="cancel-subscription-button"]');
  }

  get cancelDialog() {
    return this.page.locator('[data-testid="cancel-subscription-dialog"]');
  }

  get deleteAccountButton() {
    return this.page.locator('[data-testid="delete-account-button"]');
  }

  get deleteDialog() {
    return this.page.locator('[data-testid="delete-account-dialog"]');
  }

  get downloadDataButton() {
    return this.page.locator('[data-testid="download-data-button"]');
  }

  async clickCancelSubscription() {
    await this.cancelSubscriptionButton.click();
  }

  async clickDeleteAccount() {
    await this.deleteAccountButton.click();
  }

  async fillCancelPassword(password: string) {
    await this.page.fill('#cancel-password', password);
  }

  async fillDeletePassword(password: string) {
    await this.page.fill('#delete-password', password);
  }

  async confirmCancel() {
    await this.cancelDialog.locator('button').filter({ hasText: 'Confirmar' }).click();
  }

  async confirmDelete() {
    await this.deleteDialog.locator('button').filter({ hasText: 'Eliminar' }).click();
  }
}
