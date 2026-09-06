/**
 * Legal-acceptance gate enforcement (ONB-1.3).
 *
 * The OTP verification endpoint calls `requireLegalAcceptance`
 * BEFORE allowing the code to be checked. If no row exists in
 * `legal_acceptances` for this phone number, the endpoint rejects
 * the request — regardless of what the client sent.
 *
 * This prevents a technically savvy user from bypassing the UI
 * screen order and calling the verify-OTP endpoint directly.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { legalAcceptances } from "../db/legal-acceptances-schema.js";

/**
 * Record that a user has accepted the legal terms.
 *
 * Called by the accept-legal endpoint (ONB-1.3 UI flow).
 * Upserts so that re-acceptance after a version change is idempotent.
 */
export async function recordLegalAcceptance({
  phoneNumber,
  legalVersion,
}: {
  phoneNumber: string;
  legalVersion: string;
}): Promise<void> {
  const db = getDb();

  await db
    .insert(legalAcceptances)
    .values({
      phoneNumber,
      legalVersion,
      acceptedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: legalAcceptances.phoneNumber,
      set: {
        legalVersion,
        acceptedAt: new Date(),
      },
    });
}

/**
 * Check whether a phone number has accepted legal terms.
 *
 * Returns `true` if a row exists in `legal_acceptances` for this
 * phone number — does NOT check version or recency.
 */
export async function hasAcceptedLegal(
  phoneNumber: string,
): Promise<boolean> {
  const db = getDb();

  const [row] = await db
    .select({ phoneNumber: legalAcceptances.phoneNumber })
    .from(legalAcceptances)
    .where(eq(legalAcceptances.phoneNumber, phoneNumber))
    .limit(1);

  return row !== undefined;
}

/**
 * Gate check — throws if legal acceptance is missing.
 *
 * This is the function the OTP-verify endpoint calls. It does NOT
 * return a boolean — it throws a descriptive error so the endpoint
 * can map it to the appropriate HTTP response.
 */
export async function requireLegalAcceptance(
  phoneNumber: string,
): Promise<void> {
  const accepted = await hasAcceptedLegal(phoneNumber);
  if (!accepted) {
    throw new LegalAcceptanceRequiredError(phoneNumber);
  }
}

export class LegalAcceptanceRequiredError extends Error {
  readonly code = "LEGAL_NOT_ACCEPTED" as const;
  readonly statusCode = 403;

  constructor(phoneNumber: string) {
    super(
      `OTP verification rejected: no legal_acceptances row for ${phoneNumber}. ` +
        `The client must call the accept-legal endpoint before retrying.`,
    );
    this.name = "LegalAcceptanceRequiredError";
  }
}
