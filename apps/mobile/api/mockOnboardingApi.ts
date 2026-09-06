// api/mockOnboardingApi.ts
// ONB-1.0 — Mock API layer for onboarding
// Stands in for the real Supabase-backed auth flow until live backend work lands.
// All state is in-memory and resets on app restart.
// Matches Tech Arch §7.2 contract exactly.

const RESEND_COOLDOWN_MS = 30_000;
const LOCKOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const OTP_EXPIRY_MS = 5 * 60_000; // 5 minutes
const MOCK_CORRECT_CODE = '123456';

// Pre-registered numbers for testing (ONB-1.6)
const REGISTERED_NUMBERS = new Set<string>([
  '+911234567890',
  '+919876543210',
  '+14155552671',
]);

type OtpSession = {
  phoneNumber: string;
  sentAt: number;
  attemptsUsed: number;
  lockedUntil: number | null;
  code: string;
  legalAccepted: boolean;
};

let activeSession: OtpSession | null = null;
// Legal acceptance is durable state, separate from a transient OTP session.
const acceptedLegalNumbers = new Set<string>();

function now() {
  return Date.now();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockOnboardingApi = {
  // Check if a number is already registered (ONB-1.6)
  async isNumberRegistered(phoneNumber: string): Promise<boolean> {
    await delay(300);
    return REGISTERED_NUMBERS.has(phoneNumber);
  },

  // Send OTP - starts a new session or checks cooldown
  async sendOtp(phoneNumber: string): Promise<{ success: true }> {
    await delay(400);

    if (!acceptedLegalNumbers.has(phoneNumber)) {
      throw new Error('LEGAL_NOT_ACCEPTED');
    }

    // Check if there's already a session and cooldown is active
    if (activeSession?.phoneNumber === phoneNumber) {
      const elapsed = now() - activeSession.sentAt;
      if (elapsed < RESEND_COOLDOWN_MS) {
        throw new Error('RESEND_COOLDOWN_ACTIVE');
      }
    }

    // Generate a new OTP (always 123456 for demo)
    const code = MOCK_CORRECT_CODE;

    activeSession = {
      phoneNumber,
      sentAt: now(),
      attemptsUsed: 0,
      lockedUntil: null,
      code,
      legalAccepted: true,
    };

    return { success: true };
  },

  // Mark legal acceptance (ONB-1.3)
  async acceptLegal(phoneNumber: string): Promise<{ success: true }> {
    await delay(200);
    acceptedLegalNumbers.add(phoneNumber);
    if (activeSession?.phoneNumber === phoneNumber) {
      activeSession.legalAccepted = true;
    }
    return { success: true };
  },

  // Check if legal has been accepted (ONB-1.3)
  async hasAcceptedLegal(phoneNumber: string): Promise<boolean> {
    await delay(100);
    return acceptedLegalNumbers.has(phoneNumber);
  },

  // Verify OTP - handles attempts, lockout, expiry (ONB-1.4)
  async verifyOtp(
    phoneNumber: string,
    code: string
  ): Promise<
    | { status: 'success' }
    | { status: 'wrong_code'; attemptsRemaining: number }
    | { status: 'locked_out'; secondsRemaining: number }
    | { status: 'expired' }
  > {
    await delay(400);

    if (!activeSession || activeSession.phoneNumber !== phoneNumber) {
      throw new Error('NO_ACTIVE_SESSION');
    }

    // Check if legal was accepted (ONB-1.3 - backend enforcement)
    if (!activeSession.legalAccepted) {
      throw new Error('LEGAL_NOT_ACCEPTED');
    }

    // Check if locked out
    if (activeSession.lockedUntil && now() < activeSession.lockedUntil) {
      return {
        status: 'locked_out',
        secondsRemaining: Math.ceil((activeSession.lockedUntil - now()) / 1000),
      };
    }

    // Check if code expired (5 minutes)
    if (now() - activeSession.sentAt > OTP_EXPIRY_MS) {
      activeSession = null;
      return { status: 'expired' };
    }

    // Check code
    if (code === activeSession.code) {
      // Success - clear session
      const session = activeSession;
      activeSession = null;
      return { status: 'success' };
    }

    // Wrong code - increment attempts
    activeSession.attemptsUsed += 1;
    const attemptsRemaining = MAX_ATTEMPTS - activeSession.attemptsUsed;

    // Check if locked out
    if (attemptsRemaining <= 0) {
      activeSession.lockedUntil = now() + LOCKOUT_MS;
      return {
        status: 'locked_out',
        secondsRemaining: LOCKOUT_MS / 1000,
      };
    }

    return { status: 'wrong_code', attemptsRemaining };
  },

  // Create profile (ONB-1.5)
  async createProfile(data: {
    phoneNumber: string;
    name: string;
    about: string;
    photo?: string | null;
  }): Promise<{ success: true; user: { id: string; name: string; about: string; photo: string | null } }> {
    await delay(500);

    // Validate name (required, non-empty)
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('NAME_REQUIRED');
    }

    // Validate about (required, cannot be empty)
    if (!data.about || data.about.trim().length === 0) {
      throw new Error('ABOUT_REQUIRED');
    }

    // Simulate user creation
    return {
      success: true,
      user: {
        id: `user_${Date.now()}`,
        name: data.name.trim(),
        about: data.about.trim(),
        photo: data.photo || null,
      },
    };
  },

  // New device handoff (ONB-1.7)
  async loginNewDevice(phoneNumber: string): Promise<{
    success: true;
    message: string;
    deviceId: string;
  }> {
    await delay(300);

    // Simulate revoking all other devices
    // In real backend, this would revoke all other sessions

    return {
      success: true,
      message: 'Other devices logged out',
      deviceId: `device_${Date.now()}`,
    };
  },

  // Clear session (for testing)
  clearSession(): void {
    activeSession = null;
  },

  // Get current session (for debugging)
  getSession(): OtpSession | null {
    return activeSession;
  },
};