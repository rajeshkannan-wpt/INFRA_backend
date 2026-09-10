import "dotenv/config";
import { createApp } from "./app.js";

const PORT = process.env.PORT ?? 4000;

const { httpServer } = createApp();
httpServer.listen(PORT, () => {
  console.log(`@wpt/backend listening on :${PORT}`);
});