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
    await expect(page.getByRole('heading', { name: /Muro de Mensajes/ })).toBeVisible();
    await expect(page.getByText('✍️ Escribe un mensaje para el anfitrión')).toBeVisible();
  });

  test('GM2 - Guest can post a message', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await page.fill('#guest-name', 'Invitado Test');
    await page.getByText('✍️ Escribe un mensaje para el anfitrión').click();
    await page.getByPlaceholder('Escribe tu mensaje...').fill('¡Felicidades!');
    await page.getByRole('button', { name: 'Publicar mensaje 💬' }).click();
    const toast = await guest.toast.getMessage();
    expect(toast).toContain('Mensaje publicado');
  });

  test('GM3 - Messages are displayed on the wall', async ({ page }) => {
    const guest = new EventGuestPage(page);
    await guest.goto('baby-shower-maria');
    await expect(page.getByText('Ana Pérez')).toBeVisible();
    await expect(page.getByText('¡Felicidades! Qué emoción')).toBeVisible();
  });
});
