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
    await page.route('**/api/upload/guest-upload', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://cdn.cloudinary.com/test/photo.jpg' }) });
    });
  });

  test('PA1 - Guest sees photo upload button on event page', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(page.getByText('📸 ¿Tomaste fotos? Súbelas aquí')).toBeVisible();
  });

  test('PA2 - Guest can upload a photo to event gallery', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await page.getByText('📸 ¿Tomaste fotos? Súbelas aquí').click();
    await page.getByRole('button', { name: 'Seleccionar foto 📷' }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: Buffer.from('fake-image-data') });
    await page.getByRole('button', { name: 'Subir foto 📸' }).click();
    const toast = await guest.toast.getMessage();
    expect(toast).toContain('Foto subida');
  });

  test('PA3 - Gallery shows photos when available', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(page.getByRole('heading', { name: '📸 Galería' })).toBeVisible();
    await expect(page.getByAltText('Decoración')).toBeVisible();
  });
});
