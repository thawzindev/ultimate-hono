# Ultimate Hono API Project

A batteries-included setup for building APIs with [Hono](https://hono.dev/) and [Bun](https://bun.sh/).

## Features

- **Structured Logging** - Using Pino for JSON logging with pretty printing in development
- **Modular Routing** - Support for multiple route files/modules with a clean organization
- **Authentication** - JWT-based auth with role-based access control
- **Request Validation** - Schema-based validation using Zod
- **Rate Limiting** - In-memory or Redis-backed rate limiting
- **Queue Support** - In-memory or Redis-backed job queues
- **Microservices Support** - Service discovery and inter-service communication

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed on your machine

### Installation

1. Clone this repository
2. Install dependencies:

```bash
bun install
```

3. Create a `.env` file based on the provided template:

```bash
cp .env.example .env
```

4. Start the development server:

```bash
bun dev
```

## Project Structure

```
src/
  ├── config/        # Configuration files
  ├── logger/        # Logging setup
  ├── middleware/    # Custom middleware
  │   ├── auth.middleware.ts
  │   ├── rate-limit.middleware.ts
  │   └── validator.middleware.ts
  ├── modules/       # Feature modules
  │   └── microservices/  # Microservice support
  ├── queue/         # Queue implementation
  ├── routes/        # API routes
  │   ├── api.router.ts
  │   └── microservices.router.ts
  ├── services/      # Business logic
  │   └── auth.service.ts
  ├── utils/         # Utility functions
  └── index.ts       # Application entry point
```

## Authentication

The project uses JWT-based authentication. To access protected routes:

1. Get a token by authenticating
2. Include the token in the Authorization header: `Authorization: Bearer YOUR_TOKEN`
3. Access protected routes

## Request Validation

Request validation is implemented using Zod. To validate:

```typescript
// Example route with validation
app.post('/items',
  authenticate,
  validateBody(createItemSchema),
  async (c) => {
    const validatedData = c.get('validated');
    // ...
  }
);
```

## Rate Limiting

Rate limiting can be applied to any route:

```typescript
// Apply rate limiting to a route
app.use('/api/*', rateLimit({
  windowMs: 60000, // 1 minute
  max: 100, // limit each IP to 100 requests per minute
  useRedis: false // set to true to use Redis for distributed rate limiting
}));
```

## Queue Support

Create and use queues for background processing:

```typescript
// Create a queue
const emailQueue = createQueue('emails');

// Add a job to the queue
await emailQueue.enqueue({ to: 'user@example.com', subject: 'Welcome!' });

// Process jobs
emailQueue.process(async (data) => {
  // Send email
  console.log(`Sending email to ${data.to}`);
});
```

## Microservices Support

Register and discover services:

```typescript
// Register a service
const serviceId = await serviceRegistry.register({
  id: 'user-service-1',
  name: 'user-service',
  url: 'http://localhost:3001',
  health: 'http://localhost:3001/health',
  metadata: { version: '1.0.0' }
});

// Make requests to other services
const userServiceClient = createServiceClient(serviceRegistry);
const userData = await userServiceClient.request('user-service', '/users/123');
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Port to run the server on | 3000 |
| NODE_ENV | Environment (development, production, test) | development |
| JWT_SECRET | Secret for JWT signing | (required) |
| JWT_EXPIRY | JWT expiry time in seconds | 86400 (24h) |
| RATE_LIMIT_WINDOW_MS | Rate limit window in milliseconds | 60000 (1m) |
| RATE_LIMIT_MAX_REQUESTS | Maximum requests per window | 100 |
| REDIS_URL | URL for Redis connection | (optional) |
| LOG_LEVEL | Log level | info |

## Scripts

- `bun dev` - Start the development server with hot reloading
- `bun start` - Start the production server
- `bun build` - Build for production
- `bun test` - Run tests
- `bun lint` - Lint the code
- `bun format` - Format the code

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
