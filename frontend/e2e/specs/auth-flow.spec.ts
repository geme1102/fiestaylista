import { test, expect } from '@playwright/test';
import { RegisterPage } from '../pages/register.page';
import { LoginPage } from '../pages/login.page';
import { NavbarPageObject } from '../pages/components/navbar.po';
import { MOCK_USERS } from '../config/constants';
import { mockAuthApi } from '../mocks/auth.mock';
import { mockTurnstile } from '../mocks/turnstile.mock';

test.describe('Auth Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockTurnstile(page);
    await mockAuthApi(page);
  });

  test('A1 - Register exitoso redirige a onboarding', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await register.register('Test User', 'test@example.com', 'StrongPass1');
    await page.waitForURL('**/onboarding', { timeout: 10000 });
    expect(page.url()).toContain('/onboarding');
  });

  test('A2 - Register validaciones de campos vacíos', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await register.clickSubmit();
    const toastMsg = await register.toast.getMessage();
    expect(toastMsg).toContain('Completa todos los campos');
  });

  test('A3 - Register password strength indicator', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillPassword('abc');
    const weak = page.locator('[aria-label="Fortaleza de contraseña: Débil"]');
    await expect(weak).toBeVisible();
    await register.fillPassword('StrongPass1');
    const strong = page.locator('[aria-label="Fortaleza de contraseña: Fuerte"]');
    await expect(strong).toBeVisible();
  });

  test('A4 - Login exitoso redirige a dashboard', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(MOCK_USERS.free.email, 'ValidPass1');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('A5 - Login credenciales inválidas', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login('error@test.com', 'wrong');
    const toastMsg = await login.toast.getMessage();
    expect(toastMsg).toContain('Credenciales inválidas');
  });

  test('A7 - Logout redirige a landing', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(MOCK_USERS.free.email, 'ValidPass1');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    const navbar = new NavbarPageObject(page);
    await navbar.clickLogout();
    await expect(page).toHaveURL('/');
  });

  test('A8 - Ruta protegida redirige a login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?redirect/);
  });

  test('A9 - Login con redirect vuelve a ruta original', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto('/event/123');
    await login.login(MOCK_USERS.free.email, 'ValidPass1');
    await page.waitForURL('**/event/123', { timeout: 10000 });
    expect(page.url()).toContain('/event/123');
  });

  test('A10 - Toggle visibilidad de password', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await login.togglePassword();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });
});
