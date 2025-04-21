import { verify, sign } from "jsonwebtoken";
import { env } from "../config/env";
import { createLogger } from "../logger";

const logger = createLogger("auth-service");

export interface User {
  id: string;
  email: string;
  roles: string[];
}

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
}

export class AuthService {
  /**
   * Generate a JWT token for a user
   */
  static generateToken(user: User): string {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      roles: user.roles,
    };

    return sign(payload, env.JWT_SECRET, {
      expiresIn: parseInt(env.JWT_EXPIRY, 10),
    });
  }

  /**
   * Verify a JWT token
   */
  static verifyToken(token: string): TokenPayload | null {
    try {
      return verify(token, env.JWT_SECRET) as TokenPayload;
    } catch (error) {
      logger.error({ error }, "Failed to verify token");
      return null;
    }
  }

  /**
   * Check if user has required roles
   */
  static hasRoles(userRoles: string[], requiredRoles: string[]): boolean {
    return requiredRoles.every((role) => userRoles.includes(role));
  }
}
