import { createLogger } from '../../logger';
import { createClient } from 'redis';
import { env } from '../../config/env';

const logger = createLogger('microservices');

/**
 * Service discovery entry
 */
export interface ServiceInfo {
  id: string;
  name: string;
  url: string;
  health: string;
  metadata: Record<string, any>;
  lastHeartbeat: number;
}

/**
 * Service registry for microservice discovery
 */
export class ServiceRegistry {
  private services: Map<string, ServiceInfo> = new Map();
  private redisClient: any;
  private useRedis: boolean;
  private serviceCheckInterval: NodeJS.Timeout | null = null;

  constructor(useRedis: boolean = false) {
    this.useRedis = useRedis && !!env.REDIS_URL;

    if (this.useRedis) {
      try {
        this.redisClient = createClient({ url: env.REDIS_URL });
        this.redisClient.connect().catch((err: any) => {
          logger.error({ err }, 'Redis connection error in service registry');
        });
        logger.info('Redis connected for service registry');
      } catch (err) {
        logger.error({ err }, 'Failed to initialize Redis for service registry');
        this.useRedis = false;
      }
    }

    // Start health check interval
    this.serviceCheckInterval = setInterval(() => this.cleanupServices(), 30000);
  }

  /**
   * Register a service
   */
  async register(service: Omit<ServiceInfo, 'lastHeartbeat'>): Promise<string> {
    const serviceInfo: ServiceInfo = {
      ...service,
      lastHeartbeat: Date.now(),
    };

    if (this.useRedis && this.redisClient?.isReady) {
      await this.redisClient.hSet('services', service.id, JSON.stringify(serviceInfo));
    } else {
      this.services.set(service.id, serviceInfo);
    }

    logger.info({ serviceId: service.id, serviceName: service.name }, 'Service registered');
    return service.id;
  }

  /**
   * Update service heartbeat
   */
  async heartbeat(serviceId: string): Promise<boolean> {
    if (this.useRedis && this.redisClient?.isReady) {
      const serviceJson = await this.redisClient.hGet('services', serviceId);
      if (!serviceJson) {
        return false;
      }

      const service = JSON.parse(serviceJson) as ServiceInfo;
      service.lastHeartbeat = Date.now();

      await this.redisClient.hSet('services', serviceId, JSON.stringify(service));
    } else {
      const service = this.services.get(serviceId);
      if (!service) {
        return false;
      }

      service.lastHeartbeat = Date.now();
      this.services.set(serviceId, service);
    }

    logger.debug({ serviceId }, 'Service heartbeat updated');
    return true;
  }

  /**
   * Get all registered services
   */
  async getServices(): Promise<ServiceInfo[]> {
    if (this.useRedis && this.redisClient?.isReady) {
      const services = await this.redisClient.hGetAll('services');
      return Object.values(services).map(s => JSON.parse(s as string) as ServiceInfo);
    } else {
      return Array.from(this.services.values());
    }
  }

  /**
   * Find service by name
   */
  async findService(name: string): Promise<ServiceInfo | null> {
    const services = await this.getServices();
    return services.find(s => s.name === name) || null;
  }

  /**
   * Remove stale services (no heartbeat for more than 60s)
   */
  private async cleanupServices(): Promise<void> {
    try {
      const now = Date.now();
      const staleThreshold = 60000; // 60 seconds

      if (this.useRedis && this.redisClient?.isReady) {
        const services = await this.redisClient.hGetAll('services');

        for (const [id, serviceJson] of Object.entries(services)) {
          const service = JSON.parse(serviceJson as string) as ServiceInfo;

          if (now - service.lastHeartbeat > staleThreshold) {
            await this.redisClient.hDel('services', id);
            logger.info({ serviceId: id, serviceName: service.name }, 'Removed stale service');
          }
        }
      } else {
        for (const [id, service] of this.services.entries()) {
          if (now - service.lastHeartbeat > staleThreshold) {
            this.services.delete(id);
            logger.info({ serviceId: id, serviceName: service.name }, 'Removed stale service');
          }
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error cleaning up services');
    }
  }

  /**
   * Shut down the registry
   */
  async shutdown(): Promise<void> {
    if (this.serviceCheckInterval) {
      clearInterval(this.serviceCheckInterval);
      this.serviceCheckInterval = null;
    }

    if (this.useRedis && this.redisClient?.isReady) {
      await this.redisClient.quit();
    }

    logger.info('Service registry shut down');
  }
}

/**
 * Simple service client for inter-service communication
 */
export class ServiceClient {
  private registry: ServiceRegistry;

  constructor(registry: ServiceRegistry) {
    this.registry = registry;
  }

  /**
   * Make a request to another service
   */
  async request<T = any>(serviceName: string, path: string, options: RequestInit = {}): Promise<T> {
    const service = await this.registry.findService(serviceName);

    if (!service) {
      logger.error({ serviceName }, 'Service not found');
      throw new Error(`Service ${serviceName} not found`);
    }

    try {
      logger.debug({ serviceName, path }, 'Making service request');
      const response = await fetch(`${service.url}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error(
          { serviceName, path, status: response.status, error },
          'Service request failed'
        );
        throw new Error(`Service request failed: ${error}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      logger.error({ serviceName, path, error }, 'Service request error');
      throw error;
    }
  }
}

/**
 * Create a service registry instance
 */
export function createServiceRegistry(useRedis: boolean = false): ServiceRegistry {
  return new ServiceRegistry(useRedis);
}

/**
 * Create a service client for inter-service communication
 */
export function createServiceClient(registry: ServiceRegistry): ServiceClient {
  return new ServiceClient(registry);
}

export default {
  createServiceRegistry,
  createServiceClient,
};
