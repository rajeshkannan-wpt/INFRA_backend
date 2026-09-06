import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type EmbeddedConfig = {
  databaseUrl: string;
  jwtSecret: string;
  corsOrigin: string;
  port: number;
  host: string;
};

function loadConfig(): EmbeddedConfig {
  const cfgPath = fileURLToPath(new URL("./embedded-config.json", import.meta.url));
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8")) as EmbeddedConfig;
  if (!cfg.databaseUrl || !cfg.jwtSecret) {
    throw new Error("embedded-config.json must contain databaseUrl and jwtSecret");
  }
  return cfg;
}

const cfg = loadConfig();

// The rest of the backend reads configuration from the environment, so
// bake the loaded config in before `app.js` and its route modules import.
process.env.DATABASE_URL = cfg.databaseUrl;
process.env.JWT_SECRET = cfg.jwtSecret;
process.env.CORS_ORIGIN = cfg.corsOrigin;

const { createApp } = await import("./app.js");

const { httpServer } = createApp();
httpServer.listen(cfg.port, cfg.host, () => {
  console.log(`[embedded] @wpt/backend on http://${cfg.host}:${cfg.port}`);
});