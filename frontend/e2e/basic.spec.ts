import { test, expect } from '@playwright/test';

test.describe('Fiesta y Lista', () => {
  test('landing page loads and shows title', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('La forma más hermosa de')).toBeVisible({ timeout: 10000 });
  });

  test('can navigate to pricing page', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Ver Planes').waitFor({ timeout: 10000 });
    await page.getByText('Ver Planes').click();
    await expect(page).toHaveURL('/pricing');
  });

  test('register page shows form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
