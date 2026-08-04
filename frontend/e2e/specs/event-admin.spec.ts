import { test, expect } from '@playwright/test';
import { EventAdminPage } from '../pages/event-admin.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockAuthenticatedUser } from '../mocks/auth.mock';
import { mockEventsApi } from '../mocks/events.mock';
import { mockGlobalApi } from '../mocks/global.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

test.describe('Event Admin', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
    await mockTurnstile(page);
    await mockAuthenticatedUser(page);
    await mockEventsApi(page);
  });

  test('E1 - Cargar admin event muestra título y stats', async ({ page }) => {
    const admin = new EventAdminPage(page);
    await admin.goto('event-1');
    await expect(page.getByRole('heading', { name: 'Baby Shower de María' }).first()).toBeVisible();
  });

  test('E2 - Agregar regalo personalizado', async ({ page }) => {
    const admin = new EventAdminPage(page);
    await admin.goto('event-1');
    await admin.addGift('Juego de Sábanas');
    const toastMsg = await admin.toast.getMessage();
    expect(toastMsg).toBeTruthy();
  });

  test('E4 - Editar título del evento', async ({ page }) => {
    await page.route('**/api/events/event-1', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ event: { ...JSON.parse(route.request().postData() || '{}') } }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ event: { id: 'event-1', title: 'Baby Shower de María', gifts: [], photos: [] } }) });
      }
    });
    const admin = new EventAdminPage(page);
    await admin.goto('event-1');
    await admin.editTitle('Nuevo Título');
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'actualizados' }).first()).toBeVisible({ timeout: 10000 });
  });

  test('E5 - Ver botón de compartir', async ({ page }) => {
    const admin = new EventAdminPage(page);
    await admin.goto('event-1');
    await expect(page.getByRole('button', { name: /Copiar Link/ })).toBeVisible();
  });
});
