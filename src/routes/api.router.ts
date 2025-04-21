import { z } from 'zod';
import { createLogger } from '../logger';
import Router from './index';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateBody, validateQuery } from '../middleware/validator.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import usersRouter from './users.router';

const logger = createLogger('api-router');

// Define validation schemas
const createItemSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const getItemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).optional(),
});

// Create router for /api endpoints
const apiRouter = new Router('/api');

// Apply common middleware to all API routes
apiRouter.app.use(
  '*',
  rateLimit({
    windowMs: 60000, // 1 minute
    max: 100, // 100 requests per minute
  })
);

// Mount users router
apiRouter.app.route('/users', usersRouter);

// Public routes
apiRouter.app.get('/health', c => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected routes
apiRouter.app.post(
  '/items',
  authenticate,
  authorize(['user']),
  validateBody(createItemSchema),
  async c => {
    try {
      const data = c.get('validatedData').body;
      const user = c.get('user');

      logger.info({ userId: user.userId }, 'Creating new item');

      // In a real app, you would save this to a database
      return c.json(
        {
          id: crypto.randomUUID(),
          ...data,
          createdBy: user.userId,
          createdAt: new Date().toISOString(),
        },
        201
      );
    } catch (error) {
      logger.error({ error }, 'Failed to create item');
      return c.json({ message: 'Internal server error' }, 500);
    }
  }
);

apiRouter.app.get('/items', authenticate, validateQuery(getItemsQuerySchema), async c => {
  const query = c.get('validatedData').query;
  const user = c.get('user');

  logger.info({ userId: user.userId, query }, 'Fetching items');

  // In a real app, you would fetch this from a database
  const items = [
    { id: '1', name: 'Item 1', createdAt: new Date().toISOString() },
    { id: '2', name: 'Item 2', createdAt: new Date().toISOString() },
  ];

  return c.json({
    data: items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: items.length,
      totalPages: Math.ceil(items.length / query.limit),
    },
  });
});

// Admin-only routes
apiRouter.app.delete('/items/:id', authenticate, authorize(['admin']), async c => {
  const id = c.req.param('id');
  const user = c.get('user');

  logger.info({ userId: user.userId, itemId: id }, 'Deleting item');

  try {
    // In a real app, you would delete from a database
    return c.json({ message: `Item ${id} deleted` }, 200);
  } catch (error) {
    logger.error({ error, itemId: id }, 'Failed to delete item');
    return c.json({ message: 'Internal server error' }, 500);
  }
});

export default apiRouter;
