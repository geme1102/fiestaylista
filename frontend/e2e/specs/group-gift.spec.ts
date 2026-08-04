import { test, expect } from '@playwright/test';
import { EventGuestPage } from '../pages/event-guest.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockGroupGiftApi } from '../mocks/features.mock';
import { mockGlobalApi } from '../mocks/global.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';
import { MOCK_GIFTS } from '../config/test-data';

const GROUP_GIFT = { ...MOCK_GIFTS[0], id: 'gift-3', isGroupGift: true, claims: [] };

function mockEventWithGift(page: import('@playwright/test').Page, gift: typeof GROUP_GIFT) {
  return page.route('**/api/events/slug/*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      event: { id: 'event-1', title: 'Baby Shower de María', slug: 'baby-shower-maria', isActive: true },
      gifts: [gift],
      photos: [],
    }) });
  });
}

test.describe('5.3j - Group Gift Claiming', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
    await mockTurnstile(page);
    await mockGroupGiftApi(page);
    await page.addInitScript(() => {
      try { sessionStorage.setItem('fy_envelope_baby-shower-maria', 'done'); } catch {}
    });
  });

  test('GG1 - Group gift card shows join option', async ({ page }) => {
    await mockEventWithGift(page, GROUP_GIFT);
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(page.getByRole('button', { name: 'Unirme al grupo' })).toBeVisible();
  });

  test('GG2 - Guest can join a group gift', async ({ page }) => {
    await mockEventWithGift(page, GROUP_GIFT);
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    const joinBtn = page.getByRole('button', { name: 'Unirme al grupo' });
    await joinBtn.click();
    await page.locator('#claim-name').fill('Invitado Test');
    await page.getByRole('button', { name: 'Unirme' }).click();
    const toast = await guest.toast.getMessage();
    expect(toast).toContain('se unió al regalo');
  });

  test('GG3 - Group gift shows participants', async ({ page }) => {
    await mockEventWithGift(page, {
      ...GROUP_GIFT,
      claims: [{ id: 'gc-1', giftId: 'gift-3', claimedBy: 'Ana Pérez', createdAt: new Date().toISOString() }],
    });
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(page.getByText('1 persona participa')).toBeVisible();
    await expect(page.getByText('Ana Pérez')).toBeVisible();
  });
});
