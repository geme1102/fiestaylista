import { test, expect } from '@playwright/test';
import { EventGuestPage } from '../pages/event-guest.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockPublicEventsApi } from '../mocks/events.mock';

test.describe('Event Guest', () => {
  test.beforeEach(async ({ page }) => {
    await mockTurnstile(page);
    await mockPublicEventsApi(page);
  });

  test('G1 - Cargar página pública del evento', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(page.locator('h1')).toContainText('Baby Shower de María');
  });

  test('G2 - Ver lista de regalos visible', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(guest.giftList).toBeVisible();
  });

  test('G3 - Apartar regalo abre modal de éxito', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await guest.claimGift('gift-1', 'Invitado Test');
    await expect(guest.successModal).toBeVisible({ timeout: 5000 });
  });
});
