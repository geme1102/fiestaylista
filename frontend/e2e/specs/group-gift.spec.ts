import { test, expect } from '@playwright/test';
import { EventGuestPage } from '../pages/event-guest.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockPublicEventsApi } from '../mocks/events.mock';
import { mockGroupGiftApi } from '../mocks/features.mock';
import { mockGlobalApi } from '../mocks/global.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';
import { MOCK_GIFTS } from '../config/test-data';

test.describe('5.3j - Group Gift Claiming', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
    await mockTurnstile(page);
    await mockGroupGiftApi(page);
  });

  test('GG1 - Group gift card shows contribution progress', async ({ page }) => {
    await page.route('**/api/events/slug/*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        event: { id: 'event-1', title: 'Baby Shower de María', slug: 'baby-shower-maria', gifts: [{ ...MOCK_GIFTS[0], id: 'gift-3', isGroupGift: true, targetAmount: 300000, collectedAmount: 120000 }], photos: [] },
      }) });
    });
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(page.locator('[data-testid="group-gift-progress"]')).toBeVisible();
  });

  test('GG2 - Guest can contribute to a group gift', async ({ page }) => {
    await page.route('**/api/events/slug/*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        event: { id: 'event-1', title: 'Baby Shower de María', slug: 'baby-shower-maria', gifts: [{ ...MOCK_GIFTS[0], id: 'gift-3', isGroupGift: true, targetAmount: 300000, collectedAmount: 120000 }], photos: [] },
      }) });
    });
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    const contributeBtn = page.locator('[data-testid="contribute-group-gift-gift-3"]');
    await contributeBtn.click();
    const amountInput = page.locator('[data-testid="group-contribution-amount"]');
    await amountInput.fill('50000');
    const nameInput = page.locator('[data-testid="group-contribution-name"]');
    await nameInput.fill('Invitado Test');
    await page.locator('[data-testid="confirm-group-contribution"]').click();
    const toast = await guest.toast.getMessage();
    expect(toast).toBeTruthy();
  });

  test('GG3 - Group gift target reached shows fully funded', async ({ page }) => {
    await page.route('**/api/events/slug/*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        event: { id: 'event-1', title: 'Baby Shower de María', slug: 'baby-shower-maria', gifts: [{ ...MOCK_GIFTS[0], id: 'gift-3', isGroupGift: true, targetAmount: 300000, collectedAmount: 300000 }], photos: [] },
      }) });
    });
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(page.locator('[data-testid="group-gift-funded"]')).toBeVisible();
  });
});
