import { createRequire } from "node:module";

/**
 * SMS delivery service.
 *
 * Delivery strategy (in priority order):
 *   1. If Twilio credentials are configured (SMS_TWILIO_*), send a real SMS.
 *   2. Otherwise fall back to printing the OTP to the server console so
 *      development/testing works without an SMS provider.
 *
 * The raw OTP never touches a database — it only lives in memory for the
 * duration of this function call. The database stores only the SHA-256 hash.
 */

// Minimal structural types for the lazily-loaded Twilio client, so we don't
// need the twilio package (or its @types) at build time.
interface TwilioClient {
  messages: {
    create: (opts: { body: string; to: string; from: string }) => Promise<unknown>;
  };
}

interface TwilioFactory {
  (accountSid: string, authToken: string): TwilioClient;
}

let twilioClient: TwilioClient | null = null;

// Load the Twilio SDK lazily and only when credentials are configured, so the
// app runs (and typechecks) without the package installed.
function loadTwilioSdkOnce(): TwilioFactory {
  const require = createRequire(import.meta.url);
  const { default: twilio } = require("twilio");
  return twilio as TwilioFactory;
}

async function loadTwilio() {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.SMS_TWILIO_ACCOUNT_SID;
  const authToken = process.env.SMS_TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) return null;

  try {
    const twilio = loadTwilioSdkOnce();
    twilioClient = twilio(accountSid, authToken);
    return twilioClient;
  } catch {
    // twilio package not installed — fall back to dev console delivery.
    return null;
  }
}

/**
 * Deliver an OTP to a phone number.
 *
 * @returns { delivered, via } — via is "twilio" or "console".
 */
export async function deliverOtpCode(
  phoneNumber: string,
  rawCode: string,
): Promise<{ delivered: boolean; via: string }> {
  const message = `Your verify code is ${rawCode}`;

  const client = await loadTwilio();
  if (client) {
    const from = process.env.SMS_TWILIO_FROM;
    if (!from) {
      throw new Error("SMS_TWILIO_FROM is required when Twilio is configured");
    }
    await client.messages.create({
      body: message,
      to: phoneNumber,
      from,
    });
    return { delivered: true, via: "twilio" };
  }

  // Dev fallback: print the code to the server console.
  console.log(`[SMS-DEV] OTP for ${phoneNumber}: ${rawCode}`);
  return { delivered: false, via: "console" };
}
