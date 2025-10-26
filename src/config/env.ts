import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('10000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('*'),
  
  // Supabase Configuration
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  
  // Google Maps API
  GOOGLE_MAPS_API_KEY: z.string().default('AIzaSyBRYPKaXlRhpzoAmM5-KrS2JaNDxAX_phw'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('60000'), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  
  // Ride Configuration
  DEFAULT_RIDE_RADIUS_KM: z.string().default('5.0'),
  RIDE_REQUEST_TIMEOUT_MS: z.string().default('300000'), // 5 minutes
  
  // Fare Configuration
  BASE_FARE: z.string().default('3.00'),
  PER_KM_RATE: z.string().default('1.80'),
  PER_MINUTE_RATE: z.string().default('0.30'),
  MINIMUM_FARE: z.string().default('8.00'),
  COMMISSION_RATE: z.string().default('0.15'), // 15%
});

const parsed = envSchema.parse(process.env);

export const env = {
  port: parseInt(parsed.PORT, 10),
  nodeEnv: parsed.NODE_ENV,
  corsOrigin: parsed.CORS_ORIGIN,
  
  supabase: {
    url: parsed.SUPABASE_URL || 'https://placeholder.supabase.co',
    anonKey: parsed.SUPABASE_ANON_KEY || 'placeholder-key',
    serviceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY || parsed.SUPABASE_ANON_KEY || 'placeholder-key',
  },
  
  googleMaps: {
    apiKey: parsed.GOOGLE_MAPS_API_KEY,
  },
  
  rateLimit: {
    windowMs: parseInt(parsed.RATE_LIMIT_WINDOW_MS, 10),
    maxRequests: parseInt(parsed.RATE_LIMIT_MAX_REQUESTS, 10),
  },
  
  ride: {
    defaultRadiusKm: parseFloat(parsed.DEFAULT_RIDE_RADIUS_KM),
    requestTimeoutMs: parseInt(parsed.RIDE_REQUEST_TIMEOUT_MS, 10),
  },
  
  fare: {
    baseFare: parseFloat(parsed.BASE_FARE),
    perKmRate: parseFloat(parsed.PER_KM_RATE),
    perMinuteRate: parseFloat(parsed.PER_MINUTE_RATE),
    minimumFare: parseFloat(parsed.MINIMUM_FARE),
    commissionRate: parseFloat(parsed.COMMISSION_RATE),
  },
};

export type Env = typeof env;