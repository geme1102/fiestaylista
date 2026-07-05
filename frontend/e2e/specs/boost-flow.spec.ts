import { test, expect } from '@playwright/test';
import { EventAdminPage } from '../pages/event-admin.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockAuthenticatedUser } from '../mocks/auth.mock';
import { mockEventsApi } from '../mocks/events.mock';
import { mockBoostApi } from '../mocks/features.mock';
import { mockGlobalApi } from '../mocks/global.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

test.describe('5.3c - Boost Flow', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
    await mockTurnstile(page);
    await mockAuthenticatedUser(page);
    await mockEventsApi(page);
    await mockBoostApi(page);
  });

  test('BF1 - Admin sees boost button on event admin', async ({ page }) => {
    const admin = new EventAdminPage(page);
    await admin.goto('event-1');
    await expect(admin.boostButton).toBeVisible();
  });

  test('BF2 - Clicking boost opens payment flow', async ({ page }) => {
    const admin = new EventAdminPage(page);
    await admin.goto('event-1');
    await admin.clickBoost();
    const payBtn = page.locator('[data-testid="pay-boost-button"]');
    await expect(payBtn).toBeVisible();
  });

  test('BF3 - Completing boost redirects to Mercado Pago', async ({ page }) => {
    const admin = new EventAdminPage(page);
    await admin.goto('event-1');
    await admin.clickBoost();
    const payBtn = page.locator('[data-testid="pay-boost-button"]');
    await payBtn.click();
    await expect(page).toHaveURL(/mercadopago/);
  });
});
