import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockAuthenticatedUser } from '../mocks/auth.mock';
import { mockEventsApi } from '../mocks/events.mock';
import { mockGlobalApi } from '../mocks/global.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

test.describe('Dashboard CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
    await mockTurnstile(page);
    await mockAuthenticatedUser(page);
  });

  test('D1 - Empty state muestra tipos de evento', async ({ page }) => {
    await page.route('**/api/events', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [] }) });
    });
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await expect(dashboard.emptyState).toBeVisible();
    await expect(page.locator('[data-testid="create-event-baby_shower"]')).toBeVisible();
  });

  test('D2 - Crear evento redirige a event admin', async ({ page }) => {
    await mockEventsApi(page);
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.clickNewEvent();
    await dashboard.createEvent('baby_shower', 'Baby Shower de María');
    await page.waitForURL('**/event/**', { timeout: 10000 });
    expect(page.url()).toMatch(/\/event\//);
  });

  test('D3 - Crear evento con título vacío muestra error', async ({ page }) => {
    await page.route('**/api/events', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [] }) });
    });
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.clickNewEvent();
    await page.click('button[type="submit"]');
    const toastMsg = await dashboard.toast.getMessage();
    expect(toastMsg).toContain('obligatorio');
  });

  test('D4 - Listar eventos muestra stats y cards', async ({ page }) => {
    await mockEventsApi(page);
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await expect(dashboard.getStat('events')).toBeVisible();
    await expect(dashboard.getStat('gifts')).toBeVisible();
    await expect(dashboard.getStat('raised')).toBeVisible();
    await expect(page.getByText('Mis Eventos')).toBeVisible();
  });

  test('D5 - Eliminar evento muestra confirmación y toast', async ({ page }) => {
    await mockEventsApi(page);
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.getDeleteButton('Baby Shower de María').click();
    await dashboard.modal.waitForVisible();
    await dashboard.modal.confirm();
    const toastMsg = await dashboard.toast.getMessage();
    expect(toastMsg).toContain('eliminado');
  });

  test('D6 - Copiar enlace usa clipboard API', async ({ page }) => {
    await mockEventsApi(page);
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    const copyButton = dashboard.getCopyLinkButton('Baby Shower de María');
    await copyButton.click();
    const toastMsg = await dashboard.toast.getMessage();
    expect(toastMsg).toContain('copiado');
  });
});
