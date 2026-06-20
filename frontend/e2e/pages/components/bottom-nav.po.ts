import type { Page, Locator } from '@playwright/test';

export class BottomNavPageObject {
  constructor(private page: Page) {}

  get container(): Locator {
    return this.page.locator('[data-testid="bottom-nav"]');
  }

  async isVisible(): Promise<boolean> {
    return this.container.isVisible();
  }

  async clickItem(label: string): Promise<void> {
    await this.page.locator('[data-testid="bottom-nav"]').getByText(label).click();
  }
}
