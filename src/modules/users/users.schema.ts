import { z } from 'zod';

// Schema for creating a new user
export const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  metadata: z.record(z.any()).optional().default({}),
  active: z.boolean().optional().default(true),
});

// Schema for updating an existing user
export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  metadata: z.record(z.any()).optional(),
  active: z.boolean().optional(),
});

// Schema for user pagination
export const userPaginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform(val => parseInt(val, 10)),
  limit: z
    .string()
    .optional()
    .default('10')
    .transform(val => parseInt(val, 10)),
});

// Types derived from schemas
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserPagination = z.infer<typeof userPaginationSchema>;
