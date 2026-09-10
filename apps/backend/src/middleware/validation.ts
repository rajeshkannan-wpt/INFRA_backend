/**
 * Input validation and sanitization helpers.
 *
 * Phone number validation (E.164), string length limits, and
 * basic XSS stripping for user-generated content fields.
 */

/** E.164 phone number: +[country code][subscriber number], 8-15 digits total. */
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

/**
 * Validate a phone number in E.164 format.
 * Returns true if valid, false otherwise.
 */
export function isValidE164(phone: string): boolean {
  return typeof phone === "string" && E164_REGEX.test(phone);
}

/** Maximum lengths for profile fields. */
export const MAX_NAME_LENGTH = 100;
export const MAX_ABOUT_LENGTH = 500;
export const MAX_PHOTO_LENGTH = 2048;

/**
 * Strip potentially dangerous HTML/script tags from a string.
 * This is a basic sanitizer — for full HTML sanitization use a library
 * like DOMPurify on the client side.
 */
export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, "") // strip HTML tags
    .replace(/javascript:/gi, "") // strip javascript: URIs
    .replace(/on\w+\s*=/gi, "") // strip on* event handlers
    .trim();
}

/**
 * Sanitize a profile field: strip HTML, enforce max length.
 * Returns the sanitized string or undefined if the input was undefined.
 */
export function sanitizeProfileField(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return undefined;
  const cleaned = stripHtml(value).slice(0, maxLength);
  return cleaned || undefined;
}
