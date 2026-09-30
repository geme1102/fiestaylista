import type { Page } from '@playwright/test';

export async function mockTurnstile(page: Page) {
  await page.route('**/turnstile/v0/api.js*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.turnstile = {
          render: (container, options) => {
            // Simula appearance: 'execute' — render NO dispara el callback
            // automáticamente; solo execute() lo hace (igual que en producción).
            window.__turnstileCallbacks = window.__turnstileCallbacks || {};
            window.__turnstileCounter = (window.__turnstileCounter || 0) + 1;
            const id = 'mock-widget-' + window.__turnstileCounter;
            window.__turnstileCallbacks[id] = options && options.callback ? options.callback : null;
            return id;
          },
          getResponse: () => 'mock-turnstile-token',
          reset: (id) => {
            const cb = window.__turnstileCallbacks && window.__turnstileCallbacks[id];
            if (cb) cb('mock-turnstile-token');
          },
          remove: (id) => {
            if (window.__turnstileCallbacks) {
              delete window.__turnstileCallbacks[id];
            }
          },
          execute: (id) => {
            // El usuario (o el código) llama execute() → el token se emite
            const cb = window.__turnstileCallbacks && window.__turnstileCallbacks[id];
            if (cb) cb('mock-turnstile-token');
          },
        };
      `,
    });
  });
}
