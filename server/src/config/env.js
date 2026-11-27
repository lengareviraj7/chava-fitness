import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().optional(),
  JWT_SECRET: z.string().default('chava_fitness_jwt_secret_key_2026_dev'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  DEFAULT_OWNER_PHONE: z.string().default('9876543210'),
  DEFAULT_OWNER_PASSWORD: z.string().default('Owner@123'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
