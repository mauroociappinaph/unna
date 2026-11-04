import { config } from 'dotenv';
config({ path: '.env.test' });

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/unna?schema=public';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-change-in-production-min-32-characters-long';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key-change-in-production-min-32-chars';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';