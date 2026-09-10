// hooks/useSession.ts
// §7.3 — Resume-time session validation + session management.
//
// On every foreground transition, the very first network call is
// checkSessionValidity against /session/check. If the backend says
// revokedAt is set (another device logged in while we were offline),
// we silently log out — same as receiving a force_logout push.
//
// SECURITY: userId is never sent in request bodies — the backend
// derives it from the verified JWT access token.

import { useState, useEffect, useRef } from 'react';
import { onboardingApi } from '@/api/onboardingApi';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Platform, AppState, AppStateStatus } from 'react-native';

const getDeviceId = (): string => {
  return `device_${Date.now()}_${Math.random().toString(36).substring(7)}`;
};

const getDeviceName = (): string => {
  const platform = Platform.OS === 'ios' ? 'iPhone' : 'Android';
  return `${platform} ${Platform.OS === 'ios' ? '' : 'Device'}`;
};

export const useSession = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [displayPhone, setDisplayPhone] = useState<string | null>(null);
  const [sessionValid, setSessionValid] = useState(true);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const appState = useRef(AppState.currentState);

  // ── §7.3: Resume-time validation ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/background/) && next === 'active') {
        checkSession();
      }
      appState.current = next;
    });

    return () => sub.remove();
  }, [userId, deviceId]);

  // Initialize session on mount
  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      const storedUserId = await SecureStore.getItemAsync('userId');
      const storedDeviceId = await SecureStore.getItemAsync('deviceId');
      const storedAccessToken = await SecureStore.getItemAsync('accessToken');

      if (storedUserId && storedDeviceId && storedAccessToken) {
        setUserId(storedUserId);
        setDeviceId(storedDeviceId);
        const storedDisplayPhone = await SecureStore.getItemAsync('displayPhone');
        if (storedDisplayPhone) setDisplayPhone(storedDisplayPhone);
        await validateSession(storedDeviceId);
      } else if (storedUserId || storedDeviceId) {
        await SecureStore.deleteItemAsync('userId');
        await SecureStore.deleteItemAsync('deviceId');
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
      }
    } catch (error) {
      console.error('Failed to initialize session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * §7.3 — Core validation logic. Returns true if session is alive.
   * Backend derives userId from JWT — only deviceId is sent.
   */
  const validateSession = async (did: string): Promise<boolean> => {
    try {
      const result = await onboardingApi.checkSessionValidity({
        deviceId: did,
      });

      if (!result.isValid) {
        await silentLogout();
        return false;
      }

      setSessionValid(true);
      setSessionMessage(null);
      return true;
    } catch (error) {
      console.warn('Session check failed (network?):', error);
      return true;
    }
  };

  /** Silent logout — clear all local state, navigate to phone-entry. */
  const silentLogout = async () => {
    setSessionValid(false);
    setSessionMessage('Logged in on another device');
    await SecureStore.deleteItemAsync('userId');
    await SecureStore.deleteItemAsync('deviceId');
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('displayPhone');
    setIsAuthenticated(false);
    setUserId(null);
    setDeviceId(null);
    setDisplayPhone(null);
    router.replace('/phone-entry');
  };

  const checkSession = async () => {
    if (!deviceId) return;
    await validateSession(deviceId);
  };

  /**
   * ONB-1.7: Create a new session for the current device.
   * Uses the refresh token from SecureStore to authenticate the handoff.
   */
  const createSession = async (newUserId: string) => {
    try {
      const newDeviceId = getDeviceId();
      const deviceName = getDeviceName();
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';

      // Get the refresh token — the handoff endpoint validates it server-side
      const refreshToken = await SecureStore.getItemAsync('refreshToken');

      const result = await onboardingApi.handleLoginHandoff({
        refreshToken: refreshToken ?? '',
        deviceInfo: {
          deviceId: newDeviceId,
          deviceName,
          platform,
        },
      });

      await SecureStore.setItemAsync('userId', newUserId);
      await SecureStore.setItemAsync('deviceId', newDeviceId);

      setUserId(newUserId);
      setDeviceId(newDeviceId);
      setIsAuthenticated(true);
      setSessionValid(true);
      setSessionMessage(result.message);

      return result.message;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('userId');
    await SecureStore.deleteItemAsync('deviceId');
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('displayPhone');
    setIsAuthenticated(false);
    setUserId(null);
    setDeviceId(null);
    setDisplayPhone(null);
    setSessionValid(false);
    router.replace('/phone-entry');
  };

  return {
    isLoading,
    isAuthenticated,
    userId,
    deviceId,
    displayPhone,
    sessionValid,
    sessionMessage,
    createSession,
    checkSession,
    logout,
  };
};
