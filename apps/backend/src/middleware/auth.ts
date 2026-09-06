/**
 * JWT authentication middleware.
 *
 * Verifies the Bearer token from the Authorization header,
 * extracts userId/deviceId/sessionId from the validated JWT payload,
 * and attaches them to res.locals.auth for downstream handlers.
 */

import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../auth/jwt.js";
import type { AccessTokenPayload } from "../auth/types.js";

declare global {
  namespace Express {
    interface Locals {
      auth?: AccessTokenPayload;
    }
  }
}

/**
 * Require a valid JWT access token.
 *
 * Responds 401 if:
 *   - No Authorization header
 *   - Not a Bearer token
 *   - Token is invalid, expired, or tampered
 *
 * On success, sets `res.locals.auth` with the verified payload
 * containing `{ sub: userId, deviceId, sid: sessionId }`.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "MISSING_TOKEN" });
    return;
  }

  const token = header.slice(7);
  if (!token) {
    res.status(401).json({ error: "EMPTY_TOKEN" });
    return;
  }

  try {
    const payload = await verifyAccessToken(token);
    res.locals.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "INVALID_TOKEN" });
  }
}
