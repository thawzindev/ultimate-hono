import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { logger as loggerMiddleware } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { prettyJSON } from "hono/pretty-json";

import { env } from "./config/env";
import logger from "./logger";
import { registerRoutes } from "./routes";
import apiRouter from "./routes/api.router";
import microservicesRouter from "./routes/microservices.router";
import { createQueue } from "./queue";

// Create Hono app
const app = new Hono();

// Setup global middleware
app.use("*", loggerMiddleware());
app.use("*", cors());
app.use("*", compress());
app.use("*", secureHeaders());
app.use("*", prettyJSON());

// Add app info middleware
app.use("*", async (c, next) => {
  c.header("X-Powered-By", "Ultimate Hono");
  await next();
});

// Register all routes
registerRoutes(app, [apiRouter, microservicesRouter]);

// Basic home route
app.get("/", (c) => {
  return c.json({
    message: "Welcome to Ultimate Hono API",
    version: "1.0.0",
    docs: "/docs",
  });
});

// Error handler
app.onError((err, c) => {
  logger.error({ err }, "Unhandled application error");

  return c.json(
    {
      message: "Internal Server Error",
      error: env.NODE_ENV === "development" ? err.message : undefined,
    },
    500
  );
});

// Create a sample queue
const sampleQueue = createQueue("sample-queue");

// Start processing jobs
sampleQueue.process(async (data) => {
  logger.info({ data }, "Processing job from queue");
});

// Listen on port
const PORT = parseInt(env.PORT, 10);

logger.info(
  {
    port: PORT,
    env: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
  },
  "Server starting..."
);

export default {
  port: PORT,
  fetch: app.fetch,
};
