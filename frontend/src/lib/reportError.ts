import * as Sentry from '@sentry/react';

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.error('[Error]', error, context ?? '');
  }
  if (typeof Sentry.captureException === 'function') {
    Sentry.captureException(error, { extra: context });
  }
}
