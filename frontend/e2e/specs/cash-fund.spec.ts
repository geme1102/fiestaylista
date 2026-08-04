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
    await expect(page.getByRole('heading', { name: 'Lluvia de Sobres' }).first()).toBeVisible();
    await expect(page.getByText('Seguridad Activa')).toBeVisible();
  });

  test('CF2 - Guest can see collected amount', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(page.getByText('$ 150.000', { exact: false }).first()).toBeVisible();
  });

  test('CF3 - Guest can register a transfer promise', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await page.fill('#guest-name', 'Invitado Test');
    await page.fill('#promise-amount', '50000');
    await page.getByRole('button', { name: '✅ Ya transferí' }).click();
    const toastMsg = await guest.toast.getMessage();
    expect(toastMsg).toContain('Gracias por tu aporte');
  });
});
