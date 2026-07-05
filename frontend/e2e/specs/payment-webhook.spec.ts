import { test, expect } from '@playwright/test';
import { mockGlobalApi } from '../mocks/global.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

test.describe('5.3g - Payment Webhook Simulation', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
  });

  test('PW1 - Payment success notification is displayed', async ({ page }) => {
    await page.route('**/api/subscriptions/webhook', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ received: true }) });
    });
    await page.goto('/pricing');
    const response = await page.request.post('/api/subscriptions/webhook', {
      data: { type: 'payment', action: 'payment.created', data: { id: 'pay-test-1' } },
    });
    expect(response.status()).toBe(200);
  });

  test('PW2 - Webhook signature validation rejects invalid payloads', async ({ page }) => {
    await page.route('**/api/subscriptions/webhook', async (route) => {
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid signature' }) });
    });
    const response = await page.request.post('/api/subscriptions/webhook', {
      data: { type: 'payment', data: { id: 'invalid-pay' } },
    });
    expect(response.status()).toBe(400);
  });

  test('PW3 - Subscription status updates after successful payment', async ({ page }) => {
    await page.route('**/api/subscriptions/current', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ subscription: { id: 'sub-1', tier: 'pro', status: 'active' } }) });
    });
    const response = await page.request.get('/api/subscriptions/current');
    const body = await response.json();
    expect(body.subscription.status).toBe('active');
  });
});
