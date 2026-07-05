import { test, expect } from '@playwright/test';
import { EventGuestPage } from '../pages/event-guest.page';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { mockPublicEventsApi } from '../mocks/events.mock';
import { mockPhotoUploadApi } from '../mocks/features.mock';
import { mockGlobalApi } from '../mocks/global.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

test.describe('5.3a - Photo Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieBanner(page);
    await mockGlobalApi(page);
    await mockTurnstile(page);
    await mockPublicEventsApi(page);
    await mockPhotoUploadApi(page);
  });

  test('PA1 - Guest sees photo upload button on event page', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(page.locator('[data-testid="photo-upload-button"]')).toBeVisible();
  });

  test('PA2 - Guest can upload a photo to event gallery', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    const uploadBtn = page.locator('[data-testid="photo-upload-button"]');
    await uploadBtn.click();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({ name: 'test.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake-image-data') });
    await expect(page.locator('[data-testid="photo-gallery"]')).toBeVisible();
  });

  test('PA3 - Gallery shows photos when available', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(page.locator('[data-testid="photo-gallery"] img').first()).toBeVisible();
  });
});
