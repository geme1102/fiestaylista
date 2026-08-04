import pino from 'pino';
import { config } from '../config.js';

const isDev = config.NODE_ENV !== 'production';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  redact: {
    paths: [
      'password', '*.password', '*.*.password',
      'token', '*.token', '*.*.token',
      'refreshToken', '*.refreshToken', '*.*.refreshToken',
      'accessToken', '*.accessToken', '*.*.accessToken',
      'resetToken', '*.resetToken', '*.*.resetToken',
      'secret', '*.secret', '*.*.secret',
      'key', '*.key', '*.*.key',
      'apiKey', '*.apiKey', '*.*.apiKey',
      'authorization', 'cookie', 'set-cookie',
      'email', '*.email', '*.*.email',
      'to', '*.to', '*.*.to',
      'payerEmail', '*.payerEmail', '*.*.payerEmail',
      'hostPhone', '*.hostPhone', '*.*.hostPhone',
      'bankPhone', '*.bankPhone', '*.*.bankPhone',
    ],
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
