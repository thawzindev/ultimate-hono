import { createClient, RedisClientType } from 'redis';
import { createLogger } from '../logger';
import { env } from '../config/env';

const logger = createLogger('queue-service');

// Job handler type
export type JobHandler<T = any> = (data: T) => Promise<void>;

// Queue interface
export interface Queue<T = any> {
  enqueue(data: T): Promise<void>;
  process(handler: JobHandler<T>): void;
  shutdown(): Promise<void>;
}

/**
 * In-memory queue implementation
 */
export class InMemoryQueue<T = any> implements Queue<T> {
  private queue: T[] = [];
  private processing = false;
  private handler: JobHandler<T> | null = null;
  private interval: NodeJS.Timeout | null = null;
  private name: string;

  constructor(name: string) {
    this.name = name;
    logger.debug({ queueName: name }, 'In-memory queue created');
  }

  async enqueue(data: T): Promise<void> {
    this.queue.push(data);
    logger.debug({ queueName: this.name, queueSize: this.queue.length }, 'Job enqueued');
  }

  process(handler: JobHandler<T>): void {
    if (this.interval) {
      clearInterval(this.interval);
    }

    this.handler = handler;
    this.interval = setInterval(() => this.processNext(), 100);
    logger.info({ queueName: this.name }, 'Started processing queue');
  }

  async shutdown(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    logger.info({ queueName: this.name, remainingJobs: this.queue.length }, 'Queue shut down');
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0 || !this.handler) {
      return;
    }

    this.processing = true;
    try {
      const job = this.queue.shift();
      if (job) {
        logger.debug({ queueName: this.name }, 'Processing job');
        await this.handler(job);
      }
    } catch (error) {
      logger.error({ error, queueName: this.name }, 'Error processing job');
    } finally {
      this.processing = false;
    }
  }
}

/**
 * Redis-backed queue implementation
 */
export class RedisQueue<T = any> implements Queue<T> {
  private client: RedisClientType;
  private name: string;
  private processing = false;
  private handler: JobHandler<T> | null = null;
  private interval: NodeJS.Timeout | null = null;
  private connected = false;

  constructor(name: string, redisUrl: string = env.REDIS_URL || '') {
    this.name = name;
    this.client = createClient({ url: redisUrl });

    this.client.on('error', err => {
      logger.error({ err }, 'Redis queue error');
    });

    this.client
      .connect()
      .then(() => {
        this.connected = true;
        logger.info({ queueName: name }, 'Redis queue connected');
      })
      .catch(err => {
        logger.error({ err }, 'Failed to connect to Redis');
      });
  }

  async enqueue(data: T): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis queue not connected');
    }

    await this.client.lPush(`queue:${this.name}`, JSON.stringify(data));
    logger.debug({ queueName: this.name }, 'Job enqueued to Redis');
  }

  process(handler: JobHandler<T>): void {
    if (this.interval) {
      clearInterval(this.interval);
    }

    this.handler = handler;
    this.interval = setInterval(() => this.processNext(), 500);
    logger.info({ queueName: this.name }, 'Started processing Redis queue');
  }

  async shutdown(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (this.connected) {
      await this.client.quit();
      this.connected = false;
    }

    logger.info({ queueName: this.name }, 'Redis queue shut down');
  }

  private async processNext(): Promise<void> {
    if (!this.connected || this.processing || !this.handler) {
      return;
    }

    this.processing = true;
    try {
      const result = await this.client.rPop(`queue:${this.name}`);
      if (result) {
        logger.debug({ queueName: this.name }, 'Processing job from Redis');
        const job = JSON.parse(result) as T;
        await this.handler(job);
      }
    } catch (error) {
      logger.error({ error, queueName: this.name }, 'Error processing Redis job');
    } finally {
      this.processing = false;
    }
  }
}

/**
 * Create a queue instance based on environment
 */
export function createQueue<T = any>(name: string, useRedis: boolean = false): Queue<T> {
  if (useRedis && env.REDIS_URL) {
    return new RedisQueue<T>(name);
  }
  return new InMemoryQueue<T>(name);
}

export default {
  createQueue,
  InMemoryQueue,
  RedisQueue,
};
