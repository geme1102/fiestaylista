import type { Page } from '@playwright/test';
import { ToastPageObject } from './components/toast.po';

export class EventGuestPage {
  readonly toast: ToastPageObject;

  constructor(private page: Page) {
    this.toast = new ToastPageObject(page);
  }

  async goto(slug: string) {
    await this.page.addInitScript((eventSlug) => {
      try { sessionStorage.setItem(`fy_envelope_${eventSlug}`, 'done'); } catch {}
    }, slug);
    await this.page.goto(`/e/${slug}`);
  }

  get giftList() {
    return this.page.locator('[data-testid="gift-list"]');
  }

  get claimNameInput() {
    return this.page.locator('#claim-name');
  }

  get successModal() {
    return this.page.locator('[data-testid="success-modal"]');
  }

  get scrollToGiftsButton() {
    return this.page.locator('[data-testid="scroll-to-gifts"]');
  }

  async claimGift(giftId: string, name: string) {
    await this.page.fill('#guest-name', name);
    await this.page.locator(`[data-testid="gift-card-${giftId}"] button`).filter({ hasText: 'Regalar este detalle' }).click();
  }

  async isGiftClaimed(giftId: string): Promise<boolean> {
    const card = this.page.locator(`[data-testid="gift-card-${giftId}"]`);
    return card.locator('text=APARTADO CON CARIÑO POR').isVisible();
  }
}
