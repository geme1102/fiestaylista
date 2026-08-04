import { test, expect } from '@playwright/test';
import { BottomNavPageObject } from '../pages/components/bottom-nav.po';
import { mockGlobalApi } from '../mocks/global.mock';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

test.describe('Responsive Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
    await mockTurnstile(page);
  });

  test.use({ viewport: { width: 375, height: 667 } });

  test('M1 - Login mobile muestra bottom nav', async ({ page }) => {
    await page.goto('/login');
    const bottomNav = new BottomNavPageObject(page);
    await expect(bottomNav.container).toBeVisible();
  });
});
