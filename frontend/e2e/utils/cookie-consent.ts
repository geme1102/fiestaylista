import type { Page } from '@playwright/test';

export async function dismissCookieBanner(page: Page) {
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem('cookie_consent_v1')) {
        localStorage.setItem('cookie_consent_v1', JSON.stringify({ essential: true, analytics: true, preferences: true }));
      }
    } catch {}
  });
}
