import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, OnModuleInit, UseGuards, applyDecorators } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SkipThrottle, ThrottlerException, ThrottlerGuard, ThrottlerOptions, ThrottlerStorageService } from '@nestjs/throttler';

export const AUTH_THROTTLER = 'auth';
export const AUTH_RECOVERY_THROTTLER = 'auth-recovery';
export const AUTH_RATE_LIMIT_MESSAGE = 'Demasiados intentos. Esperá un minuto y volvé a probar.';

const DEFAULT_LIMIT = 10;
const MINUTE_MS = 60_000;

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const configured = Number(value);
  return Number.isInteger(configured) && configured > 0 ? configured : fallback;
};

/**
 * Attempts per minute and client IP on the auth routes: AUTH_RATE_LIMIT logins and session
 * renewals (default 10) and half as many password recovery requests and resets (default 5), which
 * send mails or take a reset link. Each route counts on its own.
 */
export function authThrottlerOptions(env: NodeJS.ProcessEnv = process.env): ThrottlerOptions[] {
  const limit = positiveInteger(env.AUTH_RATE_LIMIT, DEFAULT_LIMIT);
  return [
    { name: AUTH_THROTTLER, ttl: MINUTE_MS, limit },
    { name: AUTH_RECOVERY_THROTTLER, ttl: MINUTE_MS, limit: Math.max(1, Math.floor(limit / 2)) },
  ];
}

/**
 * Rate limit of the auth routes with its own options and counters. ThrottlerModule is global and
 * already configured by the business module, so the auth limits live here instead of joining
 * those options (which would also apply them to the public board and pedido routes).
 */
@Injectable()
export class AuthThrottlerGuard implements CanActivate, OnModuleInit {
  private readonly guard: ThrottlerGuard;

  constructor(reflector: Reflector) {
    this.guard = new ThrottlerGuard(authThrottlerOptions(), new ThrottlerStorageService(), reflector);
  }

  onModuleInit(): Promise<void> {
    return this.guard.onModuleInit();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await this.guard.canActivate(context);
    } catch (error) {
      if (error instanceof ThrottlerException) {
        throw new HttpException({ statusCode: HttpStatus.TOO_MANY_REQUESTS, message: AUTH_RATE_LIMIT_MESSAGE }, HttpStatus.TOO_MANY_REQUESTS);
      }
      throw error;
    }
  }
}

/** Login and session renewal: AUTH_RATE_LIMIT a minute per IP. */
export const ThrottleAuth = () => applyDecorators(UseGuards(AuthThrottlerGuard), SkipThrottle({ [AUTH_RECOVERY_THROTTLER]: true }));

/** Password recovery request and reset: half of AUTH_RATE_LIMIT a minute per IP. */
export const ThrottleAuthRecovery = () => applyDecorators(UseGuards(AuthThrottlerGuard), SkipThrottle({ [AUTH_THROTTLER]: true }));
