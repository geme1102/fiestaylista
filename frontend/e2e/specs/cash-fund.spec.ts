import { test, expect } from '@playwright/test';
import { EventGuestPage } from '../pages/event-guest.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockPublicEventsApi } from '../mocks/events.mock';
import { mockCashFundApi } from '../mocks/features.mock';
import { mockGlobalApi } from '../mocks/global.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

test.describe('5.3b - Cash Fund Flow', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
    await mockTurnstile(page);
    await mockPublicEventsApi(page);
    await mockCashFundApi(page);
  });

  test('CF1 - Cash fund section is visible on event page', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(page.locator('[data-testid="cash-fund-section"]')).toBeVisible();
  });

  test('CF2 - Guest can see collected amount', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(page.locator('[data-testid="collected-amount"]')).toBeVisible();
  });

  test('CF3 - Contribute button redirects to Mercado Pago', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    const contributeBtn = page.locator('[data-testid="contribute-button"]');
    await contributeBtn.click();
    const nameInput = page.locator('[data-testid="contributor-name-input"]');
    await nameInput.fill('Invitado Test');
    const amountInput = page.locator('[data-testid="contribution-amount-input"]');
    await amountInput.fill('50000');
    await page.locator('[data-testid="confirm-contribution-button"]').click();
    await expect(page).toHaveURL(/mercadopago/);
  });
});
