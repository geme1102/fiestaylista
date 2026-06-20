import { test, expect } from '@playwright/test';
import { LandingPage } from '../pages/landing.page';
import { BottomNavPageObject } from '../pages/components/bottom-nav.po';

test.describe('Responsive Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('M1 - Landing mobile muestra bottom nav', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    const bottomNav = new BottomNavPageObject(page);
    await expect(bottomNav.container).toBeVisible();
  });
});
