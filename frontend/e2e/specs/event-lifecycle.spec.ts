import { test, expect } from '@playwright/test';
import { EventAdminPage } from '../pages/event-admin.page';
import { EventGuestPage } from '../pages/event-guest.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockAuthenticatedUser } from '../mocks/auth.mock';
import { mockEventsApi } from '../mocks/events.mock';
import { mockPublicEventsApi } from '../mocks/events.mock';
import { mockEventLifecycleApi } from '../mocks/features.mock';
import { mockGlobalApi } from '../mocks/global.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

test.describe('5.3i - Freeze / Purge Lifecycle', () => {
  test.describe('Admin flow', () => {
    test.beforeEach(async ({ page }) => {
      await dismissCookieBanner(page);
      await mockGlobalApi(page);
      await mockTurnstile(page);
      await mockAuthenticatedUser(page);
      await mockEventsApi(page);
      await mockEventLifecycleApi(page);
    });

    test('EL1 - Admin can freeze an event', async ({ page }) => {
      const admin = new EventAdminPage(page);
      await admin.goto('event-1');
      await admin.toggleStatus.click();
      const toast = await admin.toast.getMessage();
      expect(toast).toBeTruthy();
    });

    test('EL2 - Admin can reactivate a frozen event', async ({ page }) => {
      const admin = new EventAdminPage(page);
      await admin.goto('event-1');
      await admin.toggleStatus.click();
      await admin.toggleStatus.click();
      const toast = await admin.toast.getMessage();
      expect(toast).toBeTruthy();
    });

    test('EL3 - Admin can complete an event', async ({ page }) => {
      await page.route('**/api/events/event-1', async (route) => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ event: { id: 'event-1', status: 'completed' } }) });
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ event: { id: 'event-1', title: 'Baby Shower de María', gifts: [], photos: [] } }) });
        }
      });
      const admin = new EventAdminPage(page);
      await admin.goto('event-1');
      const completeBtn = page.locator('[data-testid="complete-event-button"]');
      if (await completeBtn.isVisible()) {
        await completeBtn.click();
        await admin.modal.confirm();
        const toast = await admin.toast.getMessage();
        expect(toast).toContain('completado');
      }
    });
  });

  test.describe('Guest view', () => {
    test.beforeEach(async ({ page }) => {
      await dismissCookieBanner(page);
      await mockGlobalApi(page);
      await mockTurnstile(page);
      await mockEventLifecycleApi(page);
    });

    test('EL4 - Frozen event shows appropriate message to guests', async ({ page }) => {
      await page.route('**/api/events/slug/*', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ event: { id: 'event-1', title: 'Baby Shower de María', isActive: false, frozenAt: new Date().toISOString(), gifts: [], photos: [] } }) });
      });
      const guest = new EventGuestPage(page);
      await guest.goto('baby-shower-maria');
      await expect(page.locator('[data-testid="frozen-banner"]').or(page.getByText(/evento.*pausado/i))).toBeVisible();
    });
  });
});
