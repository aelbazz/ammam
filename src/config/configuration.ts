import { EnvironmentVariables, NodeEnv } from './env.validation';

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  isProduction: boolean;
  corsOrigins: string[];
  jwt: { secret: string; expiresIn: string };
  throttle: { ttlSeconds: number; limit: number; authLimit: number };
  swaggerEnabled: boolean;
  /** This API's own externally-reachable origin, e.g. for building avatar URLs. */
  apiPublicUrl: string;
  /** The Angular frontend's own public origin, e.g. for the dashboard's "visit my site". */
  frontendPublicUrl: string;
}

export function buildAppConfig(env: EnvironmentVariables): AppConfig {
  const isProduction = env.NODE_ENV === NodeEnv.Production;
  const port = Number(env.PORT);

  return {
    nodeEnv: env.NODE_ENV,
    port,
    isProduction,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    jwt: { secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN },
    throttle: {
      ttlSeconds: Number(env.THROTTLE_TTL_SECONDS),
      limit: Number(env.THROTTLE_LIMIT),
      authLimit: Number(env.AUTH_THROTTLE_LIMIT),
    },
    // Swagger defaults ON outside production, OFF in production unless explicitly enabled.
    swaggerEnabled: env.SWAGGER_ENABLED ? env.SWAGGER_ENABLED === 'true' : !isProduction,
    // Defaults only make sense in development - main.ts refuses to boot in production
    // without these explicitly set, the same way it refuses a CORS wildcard.
    apiPublicUrl: env.API_PUBLIC_URL ?? `http://localhost:${port}`,
    frontendPublicUrl: env.FRONTEND_PUBLIC_URL ?? 'http://localhost:4100',
  };
}
