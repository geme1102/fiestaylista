import type { Page } from '@playwright/test';

export async function mockTurnstile(page: Page) {
  await page.route('**/turnstile/v0/api.js*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.turnstile = {
          render: (container, options) => {
            if (options && options.callback) {
              setTimeout(() => options.callback('mock-turnstile-token'), 100);
            }
            return 'mock-widget-id';
          },
          getResponse: () => 'mock-turnstile-token',
          reset: () => {},
        };
      `,
    });
  });
}
