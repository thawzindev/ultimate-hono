import pino from 'pino';
import { env } from '../config/env';

// Configure logger
export const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
  base: {
    env: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Create child loggers for specific modules
export const createLogger = (module: string) => {
  return logger.child({ module });
};

// Export default logger
export default logger;
