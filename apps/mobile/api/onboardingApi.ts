// api/onboardingApi.ts
//
// ONB — API layer for onboarding.
//
// SECURITY: All authenticated endpoints now receive the JWT via
// Authorization header. userId is derived from the token server-side,
// never sent in request bodies. This prevents IDOR attacks.

import * as SecureStore from 'expo-secure-store';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
const API_BASE = `${BACKEND_URL}/api/v1/onboarding`;
const PROFILE_BASE = `${BACKEND_URL}/api/v1/profile`;

// ── Unauthenticated POST (OTP send, verify, accept-legal, refresh) ──
async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.error || `HTTP ${res.status}`);
    (error as any).status = res.status;
    (error as any).body = data;
    throw error;
  }

  return data as T;
}

// ── Authenticated POST (profile, session/check) ──
async function apiAuthPost<T>(path: string, body: unknown): Promise<T> {
  const token = await SecureStore.getItemAsync('accessToken');

  const res = await fetch(`${PROFILE_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.error || `HTTP ${res.status}`);
    (error as any).status = res.status;
    (error as any).body = data;
    throw error;
  }

  return data as T;
}

// ── Authenticated POST for onboarding routes (session/check) ──
async function apiOnboardingAuthPost<T>(path: string, body: unknown): Promise<T> {
  const token = await SecureStore.getItemAsync('accessToken');

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.error || `HTTP ${res.status}`);
    (error as any).status = res.status;
    (error as any).body = data;
    throw error;
  }

  return data as T;
}

// ── Types ──

export type SendOtpParams = { phoneNumber: string };
export type SendOtpResult = { success: true };

export type VerifyOtpParams = { phoneNumber: string; code: string };
export type VerifyOtpResult =
  | { status: 'success'; routing: 'chats' | 'profile_setup'; accessToken: string; refreshToken: string; userId: string; sessionId: string }
  | { status: 'wrong_code'; attemptsRemaining: number }
  | { status: 'locked_out'; secondsRemaining: number }
  | { status: 'attempts_exhausted' }
  | { status: 'expired' };

export type CheckExistingUserParams = { phoneNumber: string };
export type CheckExistingUserResult = { exists: boolean };

export type CreateProfileParams = {
  name: string;
  photo?: string;
  about: string;
};

export type CreateProfileResult = {
  success: true;
  userId: string;
  profile: {
    id: string;
    name: string;
    photo?: string;
    about: string;
    phoneNumber: string;
    createdAt: string;
  };
};

export type GetProfileResult = {
  id: string;
  name: string;
  photo?: string;
  about: string;
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
};

export type UpdateProfileParams = {
  name?: string;
  photo?: string;
  about?: string;
};

export type UpdateProfileResult = {
  success: true;
  profile: GetProfileResult;
};

export type LoginHandoffParams = {
  refreshToken: string;
  deviceInfo: {
    deviceId: string;
    deviceName: string;
    platform: 'ios' | 'android' | 'web';
  };
};

export type LoginHandoffResult = {
  success: true;
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  message: string;
  previousDevicesLoggedOut: number;
};

export const onboardingApi = {
  async sendOtp({ phoneNumber }: SendOtpParams): Promise<SendOtpResult> {
    return apiPost<SendOtpResult>('/otp/send', { phoneNumber });
  },

  async verifyOtp({ phoneNumber, code }: VerifyOtpParams): Promise<VerifyOtpResult> {
    return apiPost<VerifyOtpResult>('/otp/verify', { phoneNumber, code });
  },

  async checkExistingUser({ phoneNumber }: CheckExistingUserParams): Promise<CheckExistingUserResult> {
    return apiPost<CheckExistingUserResult>('/check-existing-user', { phoneNumber });
  },

  async handleLoginHandoff({
    refreshToken,
    deviceInfo,
  }: LoginHandoffParams): Promise<LoginHandoffResult> {
    return apiPost<LoginHandoffResult>('/login/handoff', {
      refreshToken,
      deviceInfo,
    });
  },

  async checkSessionValidity({
    deviceId,
  }: {
    deviceId: string;
  }): Promise<{ isValid: boolean; message?: string }> {
    return apiOnboardingAuthPost<{ isValid: boolean; message?: string }>('/session/check', {
      deviceId,
    });
  },

  async createProfile({ name, photo, about }: CreateProfileParams): Promise<CreateProfileResult> {
    return apiAuthPost<CreateProfileResult>('/create', {
      name,
      photo,
      about,
    });
  },

  async getProfile(): Promise<GetProfileResult> {
    return apiAuthPost<GetProfileResult>('/get', {});
  },

  async updateProfile({ name, photo, about }: UpdateProfileParams): Promise<UpdateProfileResult> {
    return apiAuthPost<UpdateProfileResult>('/update', {
      name,
      photo,
      about,
    });
  },

  async acceptLegal(phoneNumber: string): Promise<{ success: true }> {
    return apiPost<{ success: true }>('/accept-legal', { phoneNumber });
  },

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string }> {
    return apiPost<{ accessToken: string }>('/refresh', { refreshToken });
  },
};
