import type { Page } from '@playwright/test';
import { MOCK_EVENTS_LIST, MOCK_EVENT, MOCK_GIFTS, MOCK_PHOTOS } from '../config/test-data';

export async function mockEventsApi(page: Page) {
  await page.route('**/api/events', async (route) => {
    if (route.request().method() === 'GET') {
      const url = route.request().url();
      if (url.includes('empty') || url.includes('no-events')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [] }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: MOCK_EVENTS_LIST }) });
      }
    } else if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ event: MOCK_EVENT }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    }
  });

  await page.route('**/api/events/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    } else if (route.request().method() === 'PUT') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ event: MOCK_EVENT }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ event: { ...MOCK_EVENT, gifts: MOCK_GIFTS, photos: MOCK_PHOTOS } }) });
    }
  });

  await page.route('**/api/events/*/gifts', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ gift: MOCK_GIFTS[0] }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    }
  });

  await page.route('**/api/events/*/gifts/*/free', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ gift: { ...MOCK_GIFTS[1], isClaimed: false } }) });
  });

  await page.route('**/api/events/*/gifts/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    }
  });

  await page.route('**/api/events/*/photos', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photo: MOCK_PHOTOS[0] }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    }
  });

  await page.route('**/api/events/*/photos/*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
}

export async function mockPublicEventsApi(page: Page) {
  await page.route('**/api/events/slug/*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ event: { ...MOCK_EVENT, gifts: MOCK_GIFTS, photos: MOCK_PHOTOS } }) });
  });

  await page.route('**/api/events/*/gifts/*/claim', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ gift: { ...MOCK_GIFTS[0], isClaimed: true } }) });
  });
}
