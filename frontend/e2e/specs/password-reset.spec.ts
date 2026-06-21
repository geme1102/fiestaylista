import { test, expect } from '@playwright/test';
import { ForgotPasswordPage } from '../pages/forgot-password.page';
import { ResetPasswordPage } from '../pages/reset-password.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockAuthApi } from '../mocks/auth.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

test.describe('Password Reset', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockTurnstile(page);
    await mockAuthApi(page);
  });

  test('R1 - Solicitar reset exitoso', async ({ page }) => {
    const forgot = new ForgotPasswordPage(page);
    await forgot.goto();
    await forgot.fillEmail('test@example.com');
    await forgot.clickSubmit();
    await expect(forgot.successMessage).toBeVisible({ timeout: 5000 });
  });

  test('R2 - Forgot validación email inválido', async ({ page }) => {
    const forgot = new ForgotPasswordPage(page);
    await forgot.goto();
    await forgot.fillEmail('abc');
    await forgot.clickSubmit();
    const toastMsg = await forgot.toast.getMessage();
    expect(toastMsg).toContain('válido');
  });

  test('R3 - Reset password exitoso', async ({ page }) => {
    const reset = new ResetPasswordPage(page);
    await reset.goto('valid-token');
    await reset.fillPassword('NewStrongPass1');
    await reset.fillConfirmPassword('NewStrongPass1');
    await reset.clickSubmit();
    await expect(reset.successMessage).toBeVisible({ timeout: 5000 });
  });

  test('R4 - Reset sin token redirige a login', async ({ page }) => {
    const reset = new ResetPasswordPage(page);
    await reset.goto();
    await expect(page).toHaveURL('/login');
  });
});
