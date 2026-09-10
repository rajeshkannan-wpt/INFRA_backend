/**
 * §7.3 / §9.5 — Socket registry for force_logout push.
 *
 * Tracks which socket.io connections are live for each userId + deviceId
 * pair. After LOGIN-3.7's transaction commits, the registry is queried to
 * find all OTHER connected sockets for the same user, and a `force_logout`
 * event is pushed to each — causing the old device to end its session
 * locally with no advance warning (silent logout, ONB-1.7).
 *
 * The push IS the disconnect signal. No content, no warning message.
 */

import type { Server, Socket } from "socket.io";

export type SocketEntry = {
  socketId: string;
  deviceId: string;
};

// userId → Set of connected socket entries
const connections = new Map<string, Set<SocketEntry>>();

let ioRef: Server | null = null;

/** Called once from index.ts after io is created. */
export function initSocketRegistry(io: Server): void {
  ioRef = io;
}

/** Register a socket on connection. Expects userId + deviceId in handshake auth. */
export function registerSocket(socket: Socket, userId: string, deviceId: string): void {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add({ socketId: socket.id, deviceId });
}

/** Unregister a socket on disconnect. */
export function unregisterSocket(socket: Socket, userId: string): void {
  const set = connections.get(userId);
  if (!set) return;

  for (const entry of set) {
    if (entry.socketId === socket.id) {
      set.delete(entry);
      break;
    }
  }

  if (set.size === 0) {
    connections.delete(userId);
  }
}

/**
 * §7.3 — Push force_logout to all connected sockets for a user,
 * EXCEPT the one identified by `excludeDeviceId` (the new login).
 *
 * Silent logout: the push event IS the disconnect signal.
 * No content, no warning — old devices end session immediately.
 *
 * Called by executeHandoffTransaction() after the DB transaction commits.
 */
export function pushForceLogout(userId: string, excludeDeviceId: string): void {
  if (!ioRef) {
    console.warn("pushForceLogout called before socket registry initialized");
    return;
  }

  const set = connections.get(userId);
  if (!set || set.size === 0) return;

  let pushed = 0;
  for (const entry of set) {
    if (entry.deviceId !== excludeDeviceId) {
      ioRef.to(entry.socketId).emit("force_logout");
      pushed++;
    }
  }

  if (pushed > 0) {
    console.log(`force_logout pushed to ${pushed} socket(s) for user ${userId}`);
  }
}

/** Debug: get connection count for a user. */
export function getConnectionCount(userId: string): number {
  return connections.get(userId)?.size ?? 0;
}
