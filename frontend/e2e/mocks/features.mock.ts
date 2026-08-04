import type { Page } from '@playwright/test';
import { MOCK_EVENT, MOCK_GIFTS, MOCK_PHOTOS, MOCK_CONTRIBUTIONS, MOCK_MESSAGES } from '../config/test-data';

export async function mockCashFundApi(page: Page) {
  await page.route('**/api/cash/*/setup', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cashFund: { id: 'cf-1', eventId: 'event-1', collectedAmount: 0, isActive: true, bankName: 'Bancolombia', bankPhone: '3001234567' } }) });
  });

  await page.route('**/api/cash-fund/promise', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contribution: MOCK_CONTRIBUTIONS[0], cashFund: { id: 'cf-1', eventId: 'event-1', collectedAmount: 200000, isActive: true, bankName: 'Bancolombia' } }) });
  });

  await page.route('**/api/cash-fund/*/contributions', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contributions: [MOCK_CONTRIBUTIONS[0]], nextCursor: null }) });
  });

  await page.route('**/api/cash/contributions/*/cancel', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });

  await page.route('**/api/events/*/cash-fund', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cashFund: { id: 'cf-1', eventId: 'event-1', collectedAmount: 150000, isActive: true, bankName: 'Bancolombia' } }) });
  });
}

export async function mockMessagesApi(page: Page) {
  await page.route('**/api/events/*/messages', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: MOCK_MESSAGES[0] }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: MOCK_MESSAGES }) });
    }
  });
}

export async function mockPhotoUploadApi(page: Page) {
  await page.route('**/api/events/*/photos/guest-upload', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photo: MOCK_PHOTOS[0] }) });
  });

  await page.route('**/api/events/*/photos', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photo: MOCK_PHOTOS[0] }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos: MOCK_PHOTOS }) });
    }
  });
}

export async function mockTokenRefreshApi(page: Page) {
  let refreshCount = 0;
  await page.route('**/api/auth/refresh', async (route) => {
    refreshCount++;
    if (refreshCount <= 1) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'refreshed-access-token' }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'refreshed-access-token' }) });
    }
  });
}

export async function mockEventLifecycleApi(page: Page) {
  await page.route('**/api/events/*/freeze', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ event: { ...MOCK_EVENT, isActive: false, frozenAt: new Date().toISOString() } }) });
  });

  await page.route('**/api/events/*/reactivate', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ event: { ...MOCK_EVENT, isActive: true, frozenAt: null } }) });
  });

  await page.route('**/api/events/*/complete', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ event: { ...MOCK_EVENT, status: 'completed' } }) });
  });
}

export async function mockGroupGiftApi(page: Page) {
  await page.route('**/api/events/*/gifts/*/group-claim', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as { claimedBy?: string } | null;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ claim: { id: 'gc-1', giftId: 'gift-3', claimedBy: body?.claimedBy ?? 'Invitado', createdAt: new Date().toISOString() } }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ claims: [] }) });
    }
  });

  await page.route('**/api/events/*/gifts/*/toggle-group', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ gift: { ...MOCK_GIFTS[2], isGroupGift: true } }) });
  });
}
