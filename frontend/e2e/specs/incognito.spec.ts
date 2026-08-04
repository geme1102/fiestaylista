import { test, expect } from '@playwright/test';
import { EventGuestPage } from '../pages/event-guest.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockPublicEventsApi } from '../mocks/events.mock';
import { mockGlobalApi } from '../mocks/global.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

test.describe('5.3f - Incognito / Private Browsing', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      const origGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key: string) {
        if (key === 'splash_seen') return null;
        return origGetItem.call(this, key);
      };
    });
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
    await mockTurnstile(page);
    await mockPublicEventsApi(page);
  });

  test('IB1 - Event page loads without stored preferences', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(page.locator('h1')).toContainText('Baby Shower de María');
  });

  test('IB2 - Guest can claim gift without localStorage', async ({ page }) => {
    await page.context().addInitScript(() => {
      const origSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function () {
        throw new Error('localStorage not available');
      };
    });
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await page.getByRole('button', { name: 'Saltar animación' }).click().catch(() => {});
    const nameInput = page.locator('#guest-name');
    await nameInput.fill('Invitado Incognito');
    await page.locator('[data-testid^="gift-card-"] button').first().click();
    await expect(page.locator('[data-testid="success-modal"]')).toBeVisible({ timeout: 5000 });
  });

  test('IB3 - App handles localStorage quota errors gracefully', async ({ page }) => {
    await page.context().addInitScript(() => {
      const origSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function () {
        const error = new DOMException('QuotaExceededError', 'QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      };
    });
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(page.locator('h1')).toBeVisible();
  });
});
