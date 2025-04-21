import { Env, Hono } from "hono";
import { createLogger } from "../logger";

const logger = createLogger("router");

/**
 * Base router class for creating modular route handlers
 */
export class Router<E extends Env = {}> {
  public app: Hono<E>;
  public basePath: string;

  constructor(basePath: string = "") {
    this.app = new Hono<E>();
    this.basePath = basePath;
    logger.debug({ basePath }, "Created router");
  }

  /**
   * Register the router with a parent Hono app
   */
  register(parent: Hono): void {
    logger.debug({ basePath: this.basePath }, "Registering routes");
    parent.route(this.basePath, this.app);
  }
}

/**
 * Register all routers with the main application
 */
export function registerRoutes(app: Hono, routers: Router[]): void {
  logger.info(`Registering ${routers.length} route modules`);
  routers.forEach((router) => {
    router.register(app);
  });
}

export default Router;
