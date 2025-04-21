import { Context, MiddlewareHandler, Next } from "hono";
import { z } from "zod";
import { createLogger } from "../logger";

const logger = createLogger("validator");

/**
 * Type declaration for Hono context
 */
declare module "hono" {
  interface ContextVariableMap {
    // Standard validated data property
    validatedData: {
      body?: any;
      query?: any;
      params?: any;
    };
  }
}

/**
 * Validate request body against a Zod schema
 */
export const validateBody = <T extends z.ZodType>(
  schema: T
): MiddlewareHandler => {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const result = schema.safeParse(body);

      if (!result.success) {
        logger.debug({ errors: result.error.format() }, "Validation failed");
        return c.json(
          {
            message: "Validation error",
            errors: result.error.format(),
          },
          400
        );
      }

      // Initialize validatedData if it doesn't exist
      if (!c.get("validatedData")) {
        c.set("validatedData", {});
      }

      // Add validated body data to context
      const validatedData = c.get("validatedData");
      validatedData.body = result.data;

      await next();
    } catch (error) {
      logger.error({ error }, "Failed to parse request body");
      return c.json({ message: "Invalid JSON payload" }, 400);
    }
  };
};

/**
 * Validate request query params against a Zod schema
 */
export const validateQuery = <T extends z.ZodType>(
  schema: T
): MiddlewareHandler => {
  return async (c: Context, next: Next) => {
    try {
      const query = c.req.query();
      const result = schema.safeParse(query);

      if (!result.success) {
        logger.debug(
          { errors: result.error.format() },
          "Query validation failed"
        );
        return c.json(
          {
            message: "Validation error",
            errors: result.error.format(),
          },
          400
        );
      }

      // Initialize validatedData if it doesn't exist
      if (!c.get("validatedData")) {
        c.set("validatedData", {});
      }

      // Add validated query data to context
      const validatedData = c.get("validatedData");
      validatedData.query = result.data;

      await next();
    } catch (error) {
      logger.error({ error }, "Failed to validate query params");
      return c.json({ message: "Invalid query parameters" }, 400);
    }
  };
};

/**
 * Validate request params against a Zod schema
 */
export const validateParams = <T extends z.ZodType>(
  schema: T
): MiddlewareHandler => {
  return async (c: Context, next: Next) => {
    try {
      const params = c.req.param();
      const result = schema.safeParse(params);

      if (!result.success) {
        logger.debug(
          { errors: result.error.format() },
          "Params validation failed"
        );
        return c.json(
          {
            message: "Validation error",
            errors: result.error.format(),
          },
          400
        );
      }

      // Initialize validatedData if it doesn't exist
      if (!c.get("validatedData")) {
        c.set("validatedData", {});
      }

      // Add validated params data to context
      const validatedData = c.get("validatedData");
      validatedData.params = result.data;

      await next();
    } catch (error) {
      logger.error({ error }, "Failed to validate path params");
      return c.json({ message: "Invalid path parameters" }, 400);
    }
  };
};
