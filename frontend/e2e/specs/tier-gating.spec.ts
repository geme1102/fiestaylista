import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { EventAdminPage } from '../pages/event-admin.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockAuthenticatedUser } from '../mocks/auth.mock';
import { mockEventsApi } from '../mocks/events.mock';
import { mockGlobalApi } from '../mocks/global.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';
import { MOCK_USERS } from '../config/constants';
import { MOCK_EVENTS_LIST } from '../config/test-data';

test.describe('5.3d - Tier Gating', () => {
  test.describe('Free tier', () => {
    test.beforeEach(async ({ page }) => {
      await dismissCookieBanner(page);
      await mockGlobalApi(page);
      await mockTurnstile(page);
      await mockAuthenticatedUser(page, MOCK_USERS.free);
      await mockEventsApi(page);
    });

    test('TG1 - Free user sees upgrade prompt in dashboard', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await expect(page.getByText(/Plan Gratis$/)).toBeVisible();
    });

    test('TG2 - Free user sees event count within limits', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await expect(dashboard.getStat('events')).toBeVisible();
    });
  });

  test.describe('Pro tier', () => {
    test.beforeEach(async ({ page }) => {
      await dismissCookieBanner(page);
      await mockGlobalApi(page);
      await mockTurnstile(page);
      await mockAuthenticatedUser(page, MOCK_USERS.pro);
      await mockEventsApi(page);
      await page.route('**/api/subscriptions/current', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ subscription: { id: 'sub-1', userId: 'user-pro-1', tier: 'pro', status: 'active' } }) });
      });
    });

    test('TG3 - Pro user sees premium badge', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await expect(page.getByText(/Plan Pro$/)).toBeVisible();
    });
  });

  test.describe('Tier limits enforcement', () => {
    test.beforeEach(async ({ page }) => {
      await dismissCookieBanner(page);
      await mockGlobalApi(page);
      await mockTurnstile(page);
      await mockAuthenticatedUser(page, MOCK_USERS.free);
    });

    test('TG4 - Creating event beyond free limit shows error', async ({ page }) => {
      await page.route('**/api/events', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Has alcanzado el límite de eventos en tu plan free' }) });
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [] }) });
        }
      });
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await dashboard.createEvent('baby_shower', 'Otro Evento');
      const toast = await dashboard.toast.getMessage();
      expect(toast).toContain('límite');
    });
  });
});
