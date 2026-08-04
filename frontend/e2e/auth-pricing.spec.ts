import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from './utils/cookie-consent';
import { mockTurnstile } from './mocks/turnstile.mock';
import { mockGlobalApi } from './mocks/global.mock';

test.describe('Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
    await page.route('**/api/auth/me', route => route.fulfill({ status: 401 }));
    await mockTurnstile(page);
    await page.goto('/register');
  });

  test('shows register form with all fields', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Crear Cuenta');
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Empezar gratis' })).toBeVisible();
  });

  test('shows password strength indicator when typing', async ({ page }) => {
    await page.locator('#password').fill('abc');
    await expect(page.getByText('Débil')).toBeVisible();

    await page.locator('#password').fill('StrongPass1');
    await expect(page.getByText('Fuerte')).toBeVisible();
  });

  test('validates required fields on submit', async ({ page }) => {
    const submit = page.getByRole('button', { name: 'Empezar gratis' });
    await expect(submit).toBeDisabled();
    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill('test@example.com');
    await expect(submit).toBeDisabled();
    await page.locator('#password').fill('StrongPass1');
    await expect(submit).toBeDisabled();
  });

  test('validates password requirements', async ({ page }) => {
    const submit = page.getByRole('button', { name: 'Empezar gratis' });
    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('short');
    await expect(submit).toBeDisabled();
  });

  test('requires terms and privacy acceptance', async ({ page }) => {
    const submit = page.getByRole('button', { name: 'Empezar gratis' });
    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('StrongPass1');
    await expect(submit).toBeDisabled();
    await page.locator('#accept-terms').check();
    await expect(submit).toBeDisabled();
    await page.locator('#accept-privacy').check();
    await expect(submit).toBeEnabled();
  });

  test('has link to login page', async ({ page }) => {
    await page.getByText('Inicia Sesión').click();
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
    await page.route('**/api/auth/me', route => route.fulfill({ status: 401 }));
    await mockTurnstile(page);
    await page.goto('/login');
  });

  test('shows login form', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Iniciar Sesión');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar Sesión' })).toBeVisible();
  });

  test('validates empty fields on submit', async ({ page }) => {
    const submit = page.getByRole('button', { name: 'Iniciar Sesión' });
    await expect(submit).toBeDisabled();
    await page.locator('#email').fill('test@example.com');
    await expect(submit).toBeDisabled();
    await page.locator('#password').fill('password123');
    await expect(submit).toBeEnabled();
  });

  test('has link to register page', async ({ page }) => {
    await page.getByText('Regístrate').click();
    await expect(page).toHaveURL('/register');
  });

  test('has forgot password link', async ({ page }) => {
    await expect(page.getByText('¿Olvidaste tu contraseña?')).toBeVisible();
  });
});

test.describe('Pricing Page', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
    await page.route('**/api/auth/me', route => route.fulfill({ status: 401 }));
    await mockTurnstile(page);
    await page.goto('/pricing');
  });

  test('shows plan options', async ({ page }) => {
    await expect(page.getByText('Elige el plan perfecto')).toBeVisible();
    await expect(page.getByTestId('cta-free')).toBeVisible();
    await expect(page.getByTestId('cta-pro')).toBeVisible();
  });

  test('shows yearly discount toggle', async ({ page }) => {
    await page.getByText('Anual').click();
    await expect(page.getByText('Ahorra 8%')).toBeVisible();
  });

  test('Empezar Gratis redirects to register when not authenticated', async ({ page }) => {
    await page.getByTestId('cta-free').click();
    await expect(page).toHaveURL(/\/register\?plan=free/);
  });

  test('Actualizar a Pro redirects to register when not authenticated', async ({ page }) => {
    await page.getByTestId('cta-pro').click();
    await expect(page).toHaveURL(/\/register\?plan=pro/);
  });

  test('renders FAQ section', async ({ page }) => {
    await expect(page.getByText('Cancelación en cualquier momento')).toBeVisible();
  });

  test('shows Pro Plus plan card with 3 events', async ({ page }) => {
    await expect(page.getByText('Pro Plus', { exact: true })).toBeVisible();
    await expect(page.getByText('3 eventos')).toBeVisible();
    await expect(page.getByText('$99.900')).toBeVisible();
  });

  test('Actualizar a Pro Plus redirects to register when not authenticated', async ({ page }) => {
    await page.getByTestId('cta-pro-plus').click();
    await expect(page).toHaveURL(/\/register\?plan=pro_plus/);
  });
});

test.describe('Navigation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
  });

  test('landing page links to pricing', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Ver Planes').waitFor({ timeout: 10000 });
    await page.getByText('Ver Planes').click();
    await expect(page).toHaveURL('/pricing');
  });

  test('dashboard redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
