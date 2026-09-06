// Single entry point — apps/backend, apps/web, and apps/mobile all import
// from "@wpt/crypto" and never touch primitives.ts or a platform binding
// directly. This is the enforcement mechanism for §5's "logic lives here
// ONCE, not reimplemented per platform."

export * from "./primitives.js";
export * from "./x3dh.js";
export * from "./double-ratchet.js";
export * from "./sender-key.js";
