import { z } from "zod";
import Router from "./index";
import { createLogger } from "../logger";
import { validateBody } from "../middleware/validator.middleware";
import { authenticate } from "../middleware/auth.middleware";
import {
  createServiceRegistry,
  ServiceRegistry,
} from "../modules/microservices";

const logger = createLogger("ms-router");

// Create and initialize the service registry
const serviceRegistry = createServiceRegistry(false); // Set to true to use Redis

// Define validation schemas
const registerServiceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(50),
  url: z.string().url(),
  health: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

const heartbeatSchema = z.object({
  serviceId: z.string().uuid(),
});

// Create router for microservices
const microservicesRouter = new Router("/services");

// Register a service
microservicesRouter.app.post(
  "/register",
  validateBody(registerServiceSchema),
  async (c) => {
    try {
      const data = c.get("validatedData").body;
      const serviceId = data.id || crypto.randomUUID();

      await serviceRegistry.register({
        id: serviceId,
        name: data.name,
        url: data.url,
        health: data.health || `${data.url}/health`,
        metadata: data.metadata || {},
      });

      return c.json({ serviceId });
    } catch (error) {
      logger.error({ error }, "Failed to register service");
      return c.json({ message: "Failed to register service" }, 500);
    }
  }
);

// Service heartbeat
microservicesRouter.app.post(
  "/heartbeat",
  validateBody(heartbeatSchema),
  async (c) => {
    try {
      const { serviceId } = c.get("validatedData").body;
      const success = await serviceRegistry.heartbeat(serviceId);

      if (!success) {
        return c.json({ message: "Service not found" }, 404);
      }

      return c.json({ message: "Heartbeat recorded" });
    } catch (error) {
      logger.error({ error }, "Heartbeat failed");
      return c.json({ message: "Heartbeat failed" }, 500);
    }
  }
);

// List all services (protected)
microservicesRouter.app.get("/", authenticate, async (c) => {
  try {
    const services = await serviceRegistry.getServices();
    return c.json({ services });
  } catch (error) {
    logger.error({ error }, "Failed to list services");
    return c.json({ message: "Failed to list services" }, 500);
  }
});

export { serviceRegistry };
export default microservicesRouter;
