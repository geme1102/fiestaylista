import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockAuthenticatedUser } from '../mocks/auth.mock';
import { mockEventsApi } from '../mocks/events.mock';
import { mockGlobalApi } from '../mocks/global.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

test.describe('5.3h - Token Refresh Rotation', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
    await mockTurnstile(page);
    await mockEventsApi(page);
  });

  test('TR1 - Token refresh on 401 retries successfully', async ({ page }) => {
    let apiCalls = 0;
    await page.route('**/api/auth/refresh', async (route) => {
      apiCalls++;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: `refreshed-token-${apiCalls}` }) });
    });
    await page.route('**/api/auth/me', async (route) => {
      if (apiCalls === 0) {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Token expired' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'user-free-1', email: 'test@fiestaylista.com', name: 'Test User', tier: 'free' } }) });
      }
    });
    await mockAuthenticatedUser(page);
    await mockEventsApi(page);
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="stat-events"]')).toBeVisible({ timeout: 10000 });
  });

  test('TR2 - Multiple tabs share refresh token gracefully', async ({ page, context }) => {
    let refreshCount = 0;
    await page.route('**/api/auth/refresh', async (route) => {
      refreshCount++;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: `refreshed-${refreshCount}` }) });
    });
    await mockAuthenticatedUser(page);
    await mockEventsApi(page);
    const page2 = await context.newPage();
    await mockAuthenticatedUser(page2);
    await mockEventsApi(page2);
    await page.goto('/dashboard');
    await page2.goto('/dashboard');
    await expect(page.locator('[data-testid="stat-events"]')).toBeVisible({ timeout: 10000 });
    await expect(page2.locator('[data-testid="stat-events"]')).toBeVisible({ timeout: 10000 });
    await page2.close();
  });

  test('TR3 - Expired refresh token redirects to login', async ({ page }) => {
    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Refresh token expired' }) });
    });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });
});
