import type { Page } from '@playwright/test';
import { MOCK_USERS } from '../config/constants';

export async function mockAuthApi(page: Page) {
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'No autorizado' }) });
  });

  await page.route('**/api/auth/me', async (route) => {
    const url = route.request().url();
    if (url.includes('unauthorized') || url.includes('401')) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'No autorizado' }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: MOCK_USERS.free }) });
    }
  });

  await page.route('**/api/auth/login', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.email === 'error@test.com') {
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Credenciales inválidas' }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: MOCK_USERS.free, accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' }) });
    }
  });

  await page.route('**/api/auth/register', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: MOCK_USERS.free, accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' }) });
  });

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });

  await page.route('**/api/auth/forgot-password', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });

  await page.route('**/api/auth/reset-password', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
}

export async function mockAuthenticatedUser(page: Page, user = MOCK_USERS.free) {
  await page.context().addCookies([
    { name: 'hasRefresh', value: '1', url: 'http://localhost:5173' },
    { name: 'hasRefresh', value: '1', url: 'https://localhost:5173' },
  ]);

  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'mock-access-token' }) });
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user }) });
  });

  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user, accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' }) });
  });
}
