import { test, expect } from '@playwright/test';

test.describe('Fiesta y Lista', () => {
  test('landing page loads and shows title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Fiesta y Lista')).toBeVisible();
    await expect(page.locator('text=organizar tus regalos')).toBeVisible();
  });

  test('can navigate to pricing page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Ver Planes');
    await expect(page).toHaveURL('/pricing');
  });

  test('register page shows form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
