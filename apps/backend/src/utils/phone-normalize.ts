/**
 * Phone number normalization for privacy-preserving contact matching.
 *
 * Tech Arch §14.1 requires libphonenumber to produce byte-identical E.164
 * output across all platforms. Inconsistent normalization silently breaks
 * contact matching.
 *
 * Examples:
 *   normalizePhoneNumber("9876543210", "IN")    → "+919876543210"
 *   normalizePhoneNumber("+91 98765 43210")     → "+919876543210"
 *   normalizePhoneNumber("+1 (415) 555-0123")   → "+14155550123"
 */

import { parsePhoneNumber, CountryCode } from "libphonenumber-js";

/**
 * Normalize a phone number to E.164 format using libphonenumber.
 *
 * @param phoneNumber - Raw phone number (may include spaces, dashes, parens)
 * @param defaultCountry - ISO 3166-1 alpha-2 country code (e.g. "US", "IN")
 *                         Used when phoneNumber lacks a country code prefix
 * @returns E.164 formatted number (e.g. "+919876543210") or null if invalid
 */
export function normalizePhoneNumber(
  phoneNumber: string,
  defaultCountry?: CountryCode,
): string | null {
  try {
    const parsed = parsePhoneNumber(phoneNumber, defaultCountry);

    if (!parsed || !parsed.isValid()) {
      return null;
    }

    // E.164 format: +[country code][subscriber number], no spaces/dashes
    return parsed.format("E.164");
  } catch (err) {
    // parsePhoneNumber throws on invalid input
    return null;
  }
}

/**
 * Validate and normalize a phone number, throwing an error if invalid.
 *
 * @throws Error with a user-friendly message if the number is invalid
 */
export function requireNormalizedPhone(
  phoneNumber: string,
  defaultCountry?: CountryCode,
): string {
  const normalized = normalizePhoneNumber(phoneNumber, defaultCountry);

  if (!normalized) {
    throw new Error(
      `Invalid phone number: "${phoneNumber}". Expected E.164 format (e.g. +1234567890)`,
    );
  }

  return normalized;
}
