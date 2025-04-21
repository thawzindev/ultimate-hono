import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { UsersController } from '../modules/users/users.controller';
import {
  createUserSchema,
  updateUserSchema,
  userPaginationSchema,
} from '../modules/users/users.schema';

const usersRouter = new Hono();
const usersController = new UsersController();

// Get all users with pagination
usersRouter.get('/', zValidator('query', userPaginationSchema), usersController.getAll);

// Get user by ID
usersRouter.get('/:id', usersController.getById);

// Create a new user
usersRouter.post('/', zValidator('json', createUserSchema), usersController.create);

// Update a user
usersRouter.put('/:id', zValidator('json', updateUserSchema), usersController.update);

// Delete a user
usersRouter.delete('/:id', usersController.delete);

export default usersRouter;
