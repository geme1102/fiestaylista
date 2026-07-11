import pino from 'pino';
import { config } from '../config.js';

const isDev = config.NODE_ENV !== 'production';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  redact: {
    paths: ['password', '*token', '*secret', '*key', '*apiKey', '*accessToken', 'authorization', 'cookie', 'set-cookie', 'email', '*email', 'ip', 'payerEmail', 'hostPhone', 'bankPhone'],
    censor: '[REDACTED]',
  },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
});

export function createModuleLogger(module: string) {
  return logger.child({ module });
}
