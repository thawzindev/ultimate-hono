import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

// Schema for environment validation
const envSchema = z.object({
  // Server
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Auth
  JWT_SECRET: z.string(),
  JWT_EXPIRY: z.string().default('86400'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),

  // Redis
  REDIS_URL: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

// Parse and validate env
function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error(
      '❌ Invalid environment variables:',
      JSON.stringify(result.error.format(), null, 2)
    );
    throw new Error('Invalid environment variables');
  }

  return result.data;
}

// Export validated env
export const env = validateEnv();
