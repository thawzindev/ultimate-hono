import { Context } from 'hono';
import { UserService } from '../../services/user.service';
import logger from '../../logger';
import { CreateUserInput, UpdateUserInput, UserPagination } from './users.schema';

const userService = new UserService();

export class UsersController {
  // Get all users with pagination
  async getAll(c: Context): Promise<Response> {
    try {
      const { page, limit } = c.req.valid('query') as UserPagination;

      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        userService.getUsers({ skip, take: limit }),
        userService.countUsers(),
      ]);

      return c.json({
        data: users,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch users');
      return c.json({ error: 'Failed to fetch users' }, 500);
    }
  }

  // Get a user by ID
  async getById(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id');
      const user = await userService.getUserById(id);

      if (!user) {
        return c.json({ error: 'User not found' }, 404);
      }

      return c.json({ data: user });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch user');
      return c.json({ error: 'Failed to fetch user' }, 500);
    }
  }

  // Create a new user
  async create(c: Context): Promise<Response> {
    try {
      const data = c.req.valid('json') as CreateUserInput;

      // Check if email already exists
      const existingUser = await userService.getUserByEmail(data.email);
      if (existingUser) {
        return c.json({ error: 'Email already in use' }, 409);
      }

      const user = await userService.createUser(data);
      return c.json({ data: user }, 201);
    } catch (error) {
      logger.error({ error }, 'Failed to create user');
      return c.json({ error: 'Failed to create user' }, 500);
    }
  }

  // Update a user
  async update(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id');
      const data = c.req.valid('json') as UpdateUserInput;

      // Check if user exists
      const existingUser = await userService.getUserById(id);
      if (!existingUser) {
        return c.json({ error: 'User not found' }, 404);
      }

      // Check email uniqueness if email is being updated
      if (data.email && data.email !== existingUser.email) {
        const emailExists = await userService.getUserByEmail(data.email);
        if (emailExists) {
          return c.json({ error: 'Email already in use' }, 409);
        }
      }

      const updatedUser = await userService.updateUser(id, data);
      return c.json({ data: updatedUser });
    } catch (error) {
      logger.error({ error }, 'Failed to update user');
      return c.json({ error: 'Failed to update user' }, 500);
    }
  }

  // Delete a user
  async delete(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id');

      // Check if user exists
      const existingUser = await userService.getUserById(id);
      if (!existingUser) {
        return c.json({ error: 'User not found' }, 404);
      }

      await userService.deleteUser(id);
      return c.json({ success: true }, 200);
    } catch (error) {
      logger.error({ error }, 'Failed to delete user');
      return c.json({ error: 'Failed to delete user' }, 500);
    }
  }
}
