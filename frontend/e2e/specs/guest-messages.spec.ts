import { test, expect } from '@playwright/test';
import { EventGuestPage } from '../pages/event-guest.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockPublicEventsApi } from '../mocks/events.mock';
import { mockMessagesApi } from '../mocks/features.mock';
import { mockGlobalApi } from '../mocks/global.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

test.describe('5.3e - Guest Messages', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
    await mockTurnstile(page);
    await mockPublicEventsApi(page);
    await mockMessagesApi(page);
  });

  test('GM1 - Message wall is visible on event page', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(page.locator('[data-testid="message-wall"]')).toBeVisible();
  });

  test('GM2 - Guest can post a message', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    const nameInput = page.locator('[data-testid="message-name-input"]');
    await nameInput.fill('Invitado Test');
    const contentInput = page.locator('[data-testid="message-content-input"]');
    await contentInput.fill('¡Felicidades!');
    await page.locator('[data-testid="post-message-button"]').click();
    const toast = await guest.toast.getMessage();
    expect(toast).toBeTruthy();
  });

  test('GM3 - Messages are displayed on the wall', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    const messages = page.locator('[data-testid="message-item"]');
    await expect(messages.first()).toBeVisible();
  });
});
