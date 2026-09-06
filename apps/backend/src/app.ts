import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer, type Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { API_VERSION, SOCKET_NAMESPACE } from "@wpt/shared";
import onboardingRoutes from "./routes/onboarding.js";
import profileRoutes from "./routes/profile.js";
import debugRoutes from "./routes/debug.js";
import blocksRoutes from "./routes/blocks.js";
import reportsRoutes from "./routes/reports.js";
import moderationRoutes from "./routes/moderation.js";
import relayRoutes from "./routes/relay.js";
import {
  initSocketRegistry,
  registerSocket,
  unregisterSocket,
} from "./ws/socket-registry.js";
import { verifyAccessToken } from "./auth/jwt.js";

export type BackendServer = {
  httpServer: HttpServer;
  io: SocketServer;
};

/**
 * Builds the Express app + Socket.io server. Configuration comes from
 * the environment (DATABASE_URL, JWT_SECRET, CORS_ORIGIN), which is set
 * either by dotenv (dev entry) or by the embedded entry point before
 * calling this factory.
 *
 * Deliberately does NOT `listen()` — callers decide the bind address.
 */
export function createApp(): BackendServer {
  const app = express();

  // ── Security headers ──
  app.use(helmet());

  // ── CORS: never wildcard in production ──
  const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : false,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // ── Body parsing with size limit (100 KB max) ──
  app.use(express.json({ limit: "100kb" }));

  app.get(`/api/${API_VERSION}/health`, (_req, res) => {
    res.json({ ok: true });
  });

  app.use(`/api/${API_VERSION}/onboarding`, onboardingRoutes);
  app.use(`/api/${API_VERSION}/profile`, profileRoutes);
  app.use(`/api/${API_VERSION}/debug`, debugRoutes);
  app.use(`/api/${API_VERSION}/blocks`, blocksRoutes);
  app.use(`/api/${API_VERSION}/reports`, reportsRoutes);
  app.use(`/api/${API_VERSION}/moderation`, moderationRoutes);
  app.use(`/api/${API_VERSION}/relay`, relayRoutes);

  const httpServer = createServer(app);

  const io = new SocketServer(httpServer, {
    path: SOCKET_NAMESPACE,
  });

  initSocketRegistry(io);

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const userId = socket.handshake.auth?.userId as string | undefined;
    const deviceId = socket.handshake.auth?.deviceId as string | undefined;

    if (!token || !userId || !deviceId) {
      next(new Error("Authentication required"));
      return;
    }

    try {
      const payload = await verifyAccessToken(token);
      if (payload.sub !== userId) {
        next(new Error("Token userId mismatch"));
        return;
      }
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth?.userId as string;
    const deviceId = socket.handshake.auth?.deviceId as string;

    registerSocket(socket, userId, deviceId);

    socket.on("disconnect", () => {
      unregisterSocket(socket, userId);
    });
  });

  return { httpServer, io };
}