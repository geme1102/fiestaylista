import { test, expect } from '@playwright/test';
import { PricingPage } from '../pages/pricing.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockPaymentsApi } from '../mocks/payments.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

test.describe('Pricing & Payment', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockTurnstile(page);
  });

  test('P1 - Ver planes sin autenticación', async ({ page }) => {
    const pricing = new PricingPage(page);
    await pricing.goto();
    await expect(page.getByText('Elige el plan perfecto')).toBeVisible();
    await expect(pricing.ctaFree).toBeVisible();
    await expect(pricing.ctaPro).toBeVisible();
  });

  test('P2 - Empezar Gratis redirige a register', async ({ page }) => {
    const pricing = new PricingPage(page);
    await pricing.goto();
    await pricing.clickCtaFree();
    await expect(page).toHaveURL(/\/register\?plan=free/);
  });

  test('P3 - Actualizar a Pro redirige a register', async ({ page }) => {
    const pricing = new PricingPage(page);
    await pricing.goto();
    await pricing.clickCtaPro();
    await expect(page).toHaveURL(/\/register\?plan=pro/);
  });

  test('P4 - Toggle anual muestra badge de ahorro', async ({ page }) => {
    const pricing = new PricingPage(page);
    await pricing.goto();
    await pricing.clickYearly();
    await expect(pricing.yearlyBadge).toBeVisible();
    await expect(page.getByText('$288.000')).toBeVisible();
  });

  test('P7 - FAQ accordion se expande al hacer click', async ({ page }) => {
    const pricing = new PricingPage(page);
    await pricing.goto();
    const faqItem = page.locator('.glass-card.rounded-2xl').first();
    await faqItem.click();
    const answer = faqItem.locator('.max-h-96');
    await expect(answer).toBeVisible();
  });

  test('P5 - Checkout Pro con auth redirige a MP', async ({ page }) => {
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'user-pro-1', email: 'pro@test.com', name: 'Pro User', tier: 'free', emailVerified: true } }) });
    });
    await mockPaymentsApi(page);
    const pricing = new PricingPage(page);
    await pricing.goto();
    await pricing.clickCtaPro();
    await expect(page).toHaveURL(/mercadopago\.com\.co/, { timeout: 10000 });
  });
});
