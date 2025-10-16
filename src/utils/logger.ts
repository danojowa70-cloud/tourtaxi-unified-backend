import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.nodeEnv === 'production' ? 'info' : 'debug',
  transport: env.nodeEnv !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname',
    },
  } : undefined,
});