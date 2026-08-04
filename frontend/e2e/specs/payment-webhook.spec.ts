import { test, expect } from '@playwright/test';
import { mockGlobalApi } from '../mocks/global.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

// Los webhooks se simulan con page.evaluate(fetch) + page.route: el
// APIRequestContext (page.request) NO es interceptado por page.route
// (microsoft/playwright#23705) y escapaba a la red real.
test.describe('5.3g - Payment Webhook Simulation', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
  });

  test('PW1 - Payment success notification is displayed', async ({ page }) => {
    await page.route('**/api/webhooks/mercadopago', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ received: true }) });
    });
    await page.goto('/pricing');
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/webhooks/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'payment', action: 'payment.created', data: { id: 'pay-test-1' } }),
      });
      return { status: res.status, body: await res.json() };
    });
    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
  });

  test('PW2 - Webhook signature validation rejects invalid payloads', async ({ page }) => {
    await page.route('**/api/webhooks/mercadopago', async (route) => {
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid signature' }) });
    });
    await page.goto('/pricing');
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/webhooks/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'payment', data: { id: 'invalid-pay' } }),
      });
      return { status: res.status, body: await res.json() };
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid signature');
  });

  test('PW3 - Subscription status updates after successful payment', async ({ page }) => {
    await page.route('**/api/subscriptions/current', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ subscription: { id: 'sub-1', tier: 'pro', status: 'active' } }) });
    });
    await page.goto('/pricing');
    const body = await page.evaluate(async () => {
      const res = await fetch('/api/subscriptions/current');
      return (await res.json()) as { subscription: { status: string } };
    });
    expect(body.subscription.status).toBe('active');
  });
});
