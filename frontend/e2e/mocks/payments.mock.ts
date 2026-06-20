import type { Page } from '@playwright/test';
import { MOCK_SUBSCRIPTION } from '../config/test-data';

export async function mockPaymentsApi(page: Page) {
  await page.route('**/api/subscriptions/create-checkout', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://mercadopago.com.co/checkout/test' }) });
  });

  await page.route('**/api/subscriptions/current', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ subscription: MOCK_SUBSCRIPTION }) });
  });

  await page.route('**/api/subscriptions/cancel', async (route) => {
    const headers = route.request().headers();
    const password = headers['x-password'] || '';
    if (password === 'wrong') {
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Contraseña incorrecta' }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    }
  });

  await page.route('**/api/cash/contributions', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ redirectUrl: 'https://mercadopago.com.co/pay/test' }) });
  });
}
