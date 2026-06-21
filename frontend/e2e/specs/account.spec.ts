import { test, expect } from '@playwright/test';
import { AccountPage } from '../pages/account.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockAuthenticatedUser } from '../mocks/auth.mock';
import { mockPaymentsApi } from '../mocks/payments.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

test.describe('Account Management', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockTurnstile(page);
    await mockAuthenticatedUser(page);
    await mockPaymentsApi(page);
  });

  test('C1 - Ver perfil con información del usuario', async ({ page }) => {
    const account = new AccountPage(page);
    await account.goto();
    await expect(page.getByText('Mi Cuenta')).toBeVisible();
    await expect(page.getByText('Test User')).toBeVisible();
  });

  test('C3 - Cancelar suscripción requiere contraseña', async ({ page }) => {
    const account = new AccountPage(page);
    await account.goto();
    await account.clickCancelSubscription();
    await expect(account.cancelDialog).toBeVisible();
    await account.fillCancelPassword('wrong');
    await account.confirmCancel();
    const toastMsg = await account.toast.getMessage();
    expect(toastMsg).toContain('Contraseña incorrecta');
  });

  test('C4 - Descargar datos ARCO', async ({ page }) => {
    await page.route('**/api/auth/arco/my-data', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { name: 'Test User', email: 'test@test.com' } }) });
    });
    const account = new AccountPage(page);
    await account.goto();
    await account.downloadDataButton.click();
    const toastMsg = await account.toast.getMessage();
    expect(toastMsg).toContain('descargados');
  });

  test('C5 - Eliminar cuenta muestra diálogo', async ({ page }) => {
    const account = new AccountPage(page);
    await account.goto();
    await account.clickDeleteAccount();
    await expect(account.deleteDialog).toBeVisible();
  });
});
