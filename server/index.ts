import { createServer } from "http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { initSocketIO } from "./socket/index.js";

const PORT = parseInt(process.env.PORT || "8080");

const httpServer = createServer(app);
initSocketIO(httpServer);

httpServer.listen(PORT, "0.0.0.0", () => {
  logger.info({ port: PORT }, "Server listening");
});
