import { Context, MiddlewareHandler, Next } from 'hono';
import { AuthService, TokenPayload } from '../services/auth.service';
import { createLogger } from '../logger';

const logger = createLogger('auth-middleware');

declare module 'hono' {
  interface ContextVariableMap {
    user: TokenPayload;
  }
}

/**
 * Authentication middleware
 * Validates JWT token from Authorization header and adds user to context
 */
export const authenticate: MiddlewareHandler = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    logger.debug('No Authorization header found');
    return c.json({ message: 'Unauthorized' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  const payload = AuthService.verifyToken(token);

  if (!payload) {
    logger.debug('Invalid token');
    return c.json({ message: 'Unauthorized' }, 401);
  }

  // Set user in context
  c.set('user', payload);
  logger.debug({ userId: payload.userId }, 'User authenticated');

  await next();
};

/**
 * Role-based authorization middleware
 * @param requiredRoles - Array of roles required to access the route
 */
export const authorize = (requiredRoles: string[]): MiddlewareHandler => {
  return async (c: Context, next: Next) => {
    const user = c.get('user');

    if (!user) {
      logger.debug('No user found in context');
      return c.json({ message: 'Unauthorized' }, 401);
    }

    const hasAccess = AuthService.hasRoles(user.roles, requiredRoles);

    if (!hasAccess) {
      logger.debug(
        {
          userId: user.userId,
          userRoles: user.roles,
          requiredRoles,
        },
        'Insufficient permissions'
      );

      return c.json({ message: 'Forbidden' }, 403);
    }

    logger.debug({ userId: user.userId }, 'User authorized');
    await next();
  };
};
