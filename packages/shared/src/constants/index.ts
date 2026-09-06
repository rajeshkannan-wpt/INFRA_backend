export const API_VERSION = "v1";

// Real-time transport per §-table: WebSocket (Socket.IO/ws) primary,
// degrade-to-polling fallback if free-tier reliability proves insufficient.
export const SOCKET_NAMESPACE = "/realtime";
export const SOCKET_TRANSPORT_PRIMARY = "websocket" as const;
export const SOCKET_TRANSPORT_FALLBACK = "polling" as const;
