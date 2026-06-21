import { test as base, type Page } from '@playwright/test';
import { MOCK_USERS } from '../config/constants';
import { mockAuthenticatedUser } from '../mocks/auth.mock';
import { mockEventsApi } from '../mocks/events.mock';
import { mockTurnstile } from '../mocks/turnstile.mock';
import { dismissCookieBanner } from '../utils/cookie-consent';

type AuthFixture = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixture>({
  authenticatedPage: async ({ page }, use) => {
    await dismissCookieBanner(page);
    await mockTurnstile(page);
    await mockAuthenticatedUser(page);
    await mockEventsApi(page);
    await page.goto('/login');
    await page.fill('#email', MOCK_USERS.free.email);
    await page.fill('#password', 'ValidPass1');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await use(page);
  },
});

export { expect } from '@playwright/test';
