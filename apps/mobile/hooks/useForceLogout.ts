// hooks/useForceLogout.ts
// §7.3 — Silent logout listener (ONB-1.7).
//
// Connects to socket.io once the user has a valid session (userId + deviceId
// in SecureStore). On receiving `force_logout` from the server (pushed after
// a handoff transaction commits), clears all local session state and navigates
// to phone-entry. No warning, no alert — the push IS the disconnect signal.
//
// SECURITY: Passes JWT access token in handshake auth so the server can
// verify the connection belongs to a legitimate session.

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

export function useForceLogout(userId: string | null, deviceId: string | null) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!userId || !deviceId) return;

    let cancelled = false;

    const connect = async () => {
      const accessToken = await SecureStore.getItemAsync('accessToken');

      const socket = io(`${BACKEND_URL}/realtime`, {
        transports: ['websocket', 'polling'],
        auth: { userId, deviceId, token: accessToken },
      });

      if (cancelled) {
        socket.disconnect();
        return;
      }

      socketRef.current = socket;

      // §7.3 — force_logout received: old device was superseded.
      socket.on('force_logout', async () => {
        await SecureStore.deleteItemAsync('userId');
        await SecureStore.deleteItemAsync('deviceId');
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');

        router.replace('/phone-entry');
      });

      socket.on('connect_error', (err) => {
        console.warn('Socket connection error:', err.message);
      });
    };

    connect();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [userId, deviceId]);
}
