import type { Page, Locator } from '@playwright/test';

export class ModalPageObject {
  constructor(private page: Page) {}

  get confirmModal(): Locator {
    return this.page.locator('[data-testid="confirm-modal"]');
  }

  get cancelButton(): Locator {
    return this.page.locator('[data-testid="confirm-cancel"]');
  }

  get confirmButton(): Locator {
    return this.page.locator('[data-testid="confirm-confirm"]');
  }

  async confirm(): Promise<void> {
    await this.confirmButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  async waitForVisible(): Promise<void> {
    await this.confirmModal.waitFor({ state: 'visible', timeout: 5000 });
  }

  async isVisible(): Promise<boolean> {
    return this.confirmModal.isVisible();
  }
}
