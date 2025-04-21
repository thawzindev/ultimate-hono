import { prisma } from '../lib/prisma';
import type { User, Prisma } from '@prisma/client';

export class UserService {
  // Create a new user
  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  }

  // Get all users with pagination
  async getUsers(params: {
    skip?: number;
    take?: number;
    where?: Prisma.UserWhereInput;
  }): Promise<User[]> {
    const { skip, take, where } = params;
    return prisma.user.findMany({
      skip,
      take,
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get a single user by ID
  async getUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  // Get a single user by email
  async getUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  // Update a user
  async updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  // Delete a user
  async deleteUser(id: string): Promise<User> {
    return prisma.user.delete({
      where: { id },
    });
  }

  // Count users
  async countUsers(where?: Prisma.UserWhereInput): Promise<number> {
    return prisma.user.count({ where });
  }
}
