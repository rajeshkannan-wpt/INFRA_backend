import { io, type Socket } from "socket.io-client";
import {
  SOCKET_NAMESPACE,
  SOCKET_TRANSPORT_PRIMARY,
  SOCKET_TRANSPORT_FALLBACK,
} from "@wpt/shared";

export interface RealtimeClientConfig {
  baseUrl: string;
  userId?: string;
  deviceId?: string;
  getAuthToken?: () => string | null | Promise<string | null>;
}

/**
 * §7.3 — Primary transport: WebSocket. Falls back to long-polling automatically
 * if the websocket upgrade fails (relevant on free-tier hosts that don't
 * reliably support persistent connections under load) — this is
 * socket.io's built-in behavior, we just declare the transport order.
 *
 * Auth handshake includes userId + deviceId so the server can register
 * this socket in the registry and push force_logout to old devices.
 */
export async function createRealtimeClient(
  config: RealtimeClientConfig,
): Promise<Socket> {
  const token = await config.getAuthToken?.();

  const auth: Record<string, string> = {};
  if (token) auth.token = token;
  if (config.userId) auth.userId = config.userId;
  if (config.deviceId) auth.deviceId = config.deviceId;

  return io(`${config.baseUrl}${SOCKET_NAMESPACE}`, {
    transports: [SOCKET_TRANSPORT_PRIMARY, SOCKET_TRANSPORT_FALLBACK],
    auth,
  });
}
