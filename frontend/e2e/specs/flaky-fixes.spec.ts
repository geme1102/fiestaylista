import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { RegisterPage } from '../pages/register.page';
import { NavbarPageObject } from '../pages/components/navbar.po';
import { MOCK_USERS } from '../config/constants';
import { mockAuthApi } from '../mocks/auth.mock';
import { mockGlobalApi } from '../mocks/global.mock';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

test.describe('5.3k - Flaky Test Fixes', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
    await mockTurnstile(page);
    await mockAuthApi(page);
  });

  test('FIX1 - Logout uses waitFor instead of waitForTimeout', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(MOCK_USERS.free.email, 'ValidPass1');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    const navbar = new NavbarPageObject(page);
    await navbar.logoutButton.waitFor({ state: 'visible', timeout: 5000 });
    await navbar.clickLogout();
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('FIX2 - Toast waitForElement before reading content', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await register.clickSubmit();
    const toast = page.locator('[data-sonner-toast]');
    await toast.waitFor({ state: 'visible', timeout: 5000 });
    await expect(toast).toContainText('Completa todos los campos');
  });

  test('FIX3 - Navigation completes before element assertions', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
  });

  test('FIX4 - API mock order ensures no stale routes', async ({ page }) => {
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: MOCK_USERS.free }) });
    });
    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'mock-token' }) });
    });
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible({ timeout: 5000 });
  });

  test('FIX5 - Animation end before assertions', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(MOCK_USERS.free.email, 'ValidPass1');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="stat-events"]')).toBeVisible({ timeout: 5000 });
  });
});
