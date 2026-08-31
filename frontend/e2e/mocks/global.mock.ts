import type { Page } from '@playwright/test';

export async function mockGlobalApi(page: Page) {
  await page.addInitScript(() => {
    const origMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      const result = origMatchMedia(query);
      if (query === '(prefers-reduced-motion: reduce)') {
        return Object.defineProperties(result, { matches: { get: () => true } });
      }
      return result;
    };
    window.turnstile = {
      render: (_container, options) => {
        const w = window as any;
        w.__turnstileCallbacks = w.__turnstileCallbacks || {};
        w.__turnstileCounter = (w.__turnstileCounter || 0) + 1;
        const id = 'mock-widget-' + w.__turnstileCounter;
        w.__turnstileCallbacks[id] = options?.callback ?? null;
        options?.callback?.('mock-turnstile-token');
        return id;
      },
      getResponse: () => 'mock-turnstile-token',
      reset: () => {},
      remove: (id: string) => {
        const w = window as any;
        if (w.__turnstileCallbacks) delete w.__turnstileCallbacks[id];
      },
      execute: (id: string) => {
        const cb = (window as any).__turnstileCallbacks?.[id];
        if (cb) cb('mock-turnstile-token');
      },
    };
  });

  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });

  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'No autorizado' }) });
  });

  await page.route('**/api/subscriptions/current', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ subscription: null }) });
  });

  await page.route('**/api/subscriptions/payments', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ payments: [] }) });
  });

  await page.route('**/api/events/slug/*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ event: null, gifts: [], photos: [] }) });
  });
}
