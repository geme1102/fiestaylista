import type { Page, Locator } from '@playwright/test';

export class ToastPageObject {
  constructor(private page: Page) {}

  get container(): Locator {
    return this.page.locator('[data-sonner-toast]');
  }

  async getMessage(): Promise<string | null> {
    const toast = this.page.locator('[data-sonner-toast]').first();
    try {
      await toast.waitFor({ state: 'visible', timeout: 5000 });
      return await toast.textContent();
    } catch {
      return null;
    }
  }

  async waitForToast(timeout = 5000): Promise<string> {
    const toast = this.page.locator('[data-sonner-toast]').first();
    await toast.waitFor({ state: 'visible', timeout });
    return (await toast.textContent()) || '';
  }

  async expectMessage(message: string): Promise<void> {
    const text = await this.waitForToast();
    expect(text).toContain(message);
  }
}

import { expect } from '@playwright/test';
