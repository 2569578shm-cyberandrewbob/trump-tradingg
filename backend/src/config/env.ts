import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().url(),
  // Optional: leave empty to run Redis-free (DB-only dedupe + in-memory rate
  // limiting). Recommended for free tiers — see docs/deploy-free.md.
  REDIS_URL: z.string().optional(),
  // Free-tier mode: longer polling intervals, gentler on provider quotas.
  FREE_TIER_MODE: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-fable-5'),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  TRUTH_SOCIAL_API_KEY: z.string().optional(),
  NEWS_API_KEY: z.string().optional(),
  INGEST_POLL_SECONDS_DEFAULT: z.coerce.number().default(60),
  DEDUPE_WINDOW_HOURS: z.coerce.number().default(6),
  DEDUPE_SIMILARITY_THRESHOLD: z.coerce.number().default(0.85),
  MIN_RELIABILITY_FOR_CRITICAL: z.coerce.number().default(80),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isFreeTier = env.FREE_TIER_MODE === 'true';
export const redisEnabled = !!env.REDIS_URL && env.REDIS_URL.trim() !== '' && env.REDIS_URL !== 'disabled';
