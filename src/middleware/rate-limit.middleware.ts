import { Context, MiddlewareHandler, Next } from 'hono';
import { env } from '../config/env';
import { createLogger } from '../logger';
import { createClient } from 'redis';

const logger = createLogger('rate-limit');

// In-memory store for rate limiting
const inMemoryStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds
  max?: number; // Maximum requests per window
  keyGenerator?: (c: Context) => string; // Function to generate a unique key
  handler?: (c: Context, next: Next) => Response | Promise<Response>; // Custom rate limit exceeded handler
  useRedis?: boolean; // Use Redis for distributed rate limiting
}

/**
 * Rate limiting middleware
 */
export const rateLimit = (options: RateLimitOptions = {}): MiddlewareHandler => {
  const windowMs = options.windowMs || parseInt(env.RATE_LIMIT_WINDOW_MS, 10);
  const max = options.max || parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10);

  // Default key generator uses IP address
  const keyGenerator =
    options.keyGenerator ||
    ((c: Context) => {
      const ip = c.req.header('x-forwarded-for') || 'unknown';
      return `rate-limit:${ip}`;
    });

  // Default handler returns 429 Too Many Requests
  const handler =
    options.handler ||
    ((c: Context) => {
      return c.json(
        {
          message: 'Too many requests, please try again later.',
        },
        429
      );
    });

  // Redis client for distributed rate limiting
  let redisClient: any = null;
  if (options.useRedis && env.REDIS_URL) {
    try {
      redisClient = createClient({ url: env.REDIS_URL });
      redisClient.connect().catch((err: any) => {
        logger.error({ err }, 'Redis connection error');
      });
      logger.info('Redis connected for distributed rate limiting');
    } catch (err) {
      logger.error({ err }, 'Failed to initialize Redis client');
    }
  }

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c);
    let remainingRequests = 0;
    let resetTime = 0;

    if (redisClient && redisClient.isReady) {
      // Use Redis for distributed rate limiting
      try {
        const now = Date.now();
        const resetTimeKey = `${key}:reset`;

        // Get current count and reset time
        const [count, storedResetTime] = await Promise.all([
          redisClient.get(key),
          redisClient.get(resetTimeKey),
        ]);

        resetTime = storedResetTime ? parseInt(storedResetTime) : now + windowMs;

        if (now > resetTime) {
          // Window expired, reset counter
          await Promise.all([
            redisClient.set(key, '1'),
            redisClient.set(resetTimeKey, String(now + windowMs)),
            redisClient.expire(key, Math.ceil(windowMs / 1000)),
            redisClient.expire(resetTimeKey, Math.ceil(windowMs / 1000)),
          ]);
          remainingRequests = max - 1;
        } else {
          // Increment counter
          const newCount = count ? parseInt(count) + 1 : 1;
          remainingRequests = Math.max(0, max - newCount);

          if (newCount > max) {
            logger.debug({ key, count: newCount }, 'Rate limit exceeded');
            return handler(c, next);
          }

          await redisClient.set(key, String(newCount));
        }
      } catch (err) {
        logger.error({ err }, 'Redis rate limiting error');
        // Fallback to in-memory if Redis fails
        return inMemoryRateLimit(key, windowMs, max, c, next, handler);
      }
    } else {
      // Use in-memory rate limiting
      return inMemoryRateLimit(key, windowMs, max, c, next, handler);
    }

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(remainingRequests));
    c.header('X-RateLimit-Reset', String(resetTime));

    return await next();
  };
};

// Helper for in-memory rate limiting
async function inMemoryRateLimit(
  key: string,
  windowMs: number,
  max: number,
  c: Context,
  next: Next,
  handler: (c: Context, next: Next) => Response | Promise<Response>
): Promise<Response> {
  const now = Date.now();

  // Clean up expired entries
  for (const [storedKey, data] of inMemoryStore.entries()) {
    if (now > data.resetTime) {
      inMemoryStore.delete(storedKey);
    }
  }

  // Get current data
  const data = inMemoryStore.get(key);

  if (!data) {
    // First request
    inMemoryStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(max - 1));
    c.header('X-RateLimit-Reset', String(now + windowMs));

    return await next();
  }

  if (now > data.resetTime) {
    // Window expired, reset counter
    inMemoryStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(max - 1));
    c.header('X-RateLimit-Reset', String(now + windowMs));

    return await next();
  }

  // Increment counter
  data.count++;
  inMemoryStore.set(key, data);

  if (data.count > max) {
    logger.debug({ key, count: data.count }, 'Rate limit exceeded');
    return handler(c, next);
  }

  c.header('X-RateLimit-Limit', String(max));
  c.header('X-RateLimit-Remaining', String(Math.max(0, max - data.count)));
  c.header('X-RateLimit-Reset', String(data.resetTime));

  return await next();
}
