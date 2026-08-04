import { test, expect } from '@playwright/test';
import { PricingPage } from '../pages/pricing.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockPaymentsApi } from '../mocks/payments.mock';
import { mockAuthenticatedUser } from '../mocks/auth.mock';
import { mockGlobalApi } from '../mocks/global.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

test.describe('Pricing & Payment', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
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
    await expect(page.getByText('$660.000')).toBeVisible();
  });

  test('P7 - FAQ accordion se expande al hacer click', async ({ page }) => {
    const pricing = new PricingPage(page);
    await pricing.goto();
    const faqItem = page.locator('[data-testid="faq-item"]').first();
    await faqItem.click();
    await expect(faqItem).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#faq-answer-0')).toBeVisible();
  });

  test('P5 - Checkout Pro con auth redirige a MP', async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockPaymentsApi(page);
    const pricing = new PricingPage(page);
    await pricing.goto();
    await pricing.clickCtaPro();
    await expect(page).toHaveURL(/mercadopago\.com\.co/, { timeout: 10000 });
  });
});
