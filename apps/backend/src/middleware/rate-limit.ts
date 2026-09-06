/**
 * In-memory sliding-window rate limiter.
 *
 * No external dependencies (Redis etc.) — suitable for a single-instance
 * dev/staging backend. Each key (e.g. phone number, IP) gets a window
 * of `maxRequests` requests per `windowMs` milliseconds.
 *
 * For production with multiple instances, swap to Redis-backed rate limiting.
 */

import type { Request, Response, NextFunction } from "express";

interface WindowEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, WindowEntry>();

// Periodic cleanup every 60s to prevent memory leak from stale entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000).unref();

export interface RateLimitOptions {
  /** Maximum requests allowed within the window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Function to extract the rate-limit key from the request. */
  keyFn?: (req: Request) => string;
  /** Custom message returned when rate-limited. */
  message?: string;
}

/**
 * Create an Express middleware that enforces a per-key rate limit.
 *
 * @example
 * // Max 5 OTP sends per phone number per 60 seconds
 * router.post("/otp/send", rateLimit({
 *   maxRequests: 5,
 *   windowMs: 60_000,
 *   keyFn: (req) => `otp-send:${req.body.phoneNumber}`,
 * }), handler);
 */
export function rateLimit({
  maxRequests,
  windowMs,
  keyFn = (req) => req.ip ?? req.socket.remoteAddress ?? "unknown",
  message = "Too many requests. Please try again later.",
}: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyFn(req);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      // New window
      store.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "RATE_LIMITED",
        message,
        retryAfterSeconds: retryAfter,
      });
      return;
    }

    entry.count++;
    next();
  };
}
