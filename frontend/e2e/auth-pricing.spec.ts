import { test, expect } from '@playwright/test';

test.describe('Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me', route => route.fulfill({ status: 401 }));
    await page.goto('/register');
  });

  test('shows register form with all fields', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Crear Cuenta');
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear Cuenta' })).toBeVisible();
  });

  test('shows password strength indicator when typing', async ({ page }) => {
    await page.locator('#password').fill('abc');
    await expect(page.getByText('Débil')).toBeVisible();

    await page.locator('#password').fill('StrongPass1');
    await expect(page.getByText('Fuerte')).toBeVisible();
  });

  test('validates required fields on submit', async ({ page }) => {
    await page.getByRole('button', { name: 'Crear Cuenta' }).click();
    await expect(page.getByText('Completa todos los campos')).toBeVisible({ timeout: 5000 });
  });

  test('validates password requirements', async ({ page }) => {
    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('short');
    await page.getByRole('button', { name: 'Crear Cuenta' }).click();
    await expect(page.getByText('al menos 8 caracteres')).toBeVisible({ timeout: 5000 });
  });

  test('requires terms and privacy acceptance', async ({ page }) => {
    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('StrongPass1');
    await page.getByRole('button', { name: 'Crear Cuenta' }).click();
    await expect(page.getByText('Debes aceptar los términos y la política de privacidad')).toBeVisible({ timeout: 5000 });
  });

  test('has link to login page', async ({ page }) => {
    await page.getByText('Inicia Sesión').click();
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me', route => route.fulfill({ status: 401 }));
    await page.goto('/login');
  });

  test('shows login form', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Iniciar Sesión');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar Sesión' })).toBeVisible();
  });

  test('validates empty fields on submit', async ({ page }) => {
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await expect(page.getByText('Completa todos los campos')).toBeVisible({ timeout: 5000 });
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
    await page.route('**/api/auth/me', route => route.fulfill({ status: 401 }));
    await page.goto('/pricing');
  });

  test('shows plan options', async ({ page }) => {
    await expect(page.getByText('Elige el plan perfecto')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Empezar Gratis' })).toBeVisible();
    await expect(page.getByText('Actualizar a Pro')).toBeVisible();
  });

  test('shows yearly discount toggle', async ({ page }) => {
    await page.getByText('Anual').click();
    await expect(page.getByText('Ahorra 33%')).toBeVisible();
  });

  test('Empezar Gratis redirects to register when not authenticated', async ({ page }) => {
    await page.getByRole('button', { name: 'Empezar Gratis' }).click();
    await expect(page).toHaveURL('/register');
  });

  test('Actualizar a Pro redirects to register when not authenticated', async ({ page }) => {
    await page.getByText('Actualizar a Pro').click();
    await expect(page).toHaveURL('/register');
  });

  test('renders FAQ section', async ({ page }) => {
    await expect(page.getByText('Cancelación en cualquier momento')).toBeVisible();
  });
});

test.describe('Navigation Flow', () => {
  test('landing page links to pricing', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Ver Planes').waitFor({ timeout: 10000 });
    await page.getByText('Ver Planes').click();
    await expect(page).toHaveURL('/pricing');
  });

  test('dashboard redirects to login when not authenticated', async ({ page }) => {
    await page.route('**/api/auth/me', route => route.fulfill({ status: 401 }));
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
