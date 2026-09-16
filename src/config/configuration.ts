import { EnvironmentVariables, NodeEnv } from './env.validation';

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  isProduction: boolean;
  corsOrigins: string[];
  jwt: { secret: string; expiresIn: string };
  throttle: { ttlSeconds: number; limit: number; authLimit: number };
  swaggerEnabled: boolean;
}

export function buildAppConfig(env: EnvironmentVariables): AppConfig {
  const isProduction = env.NODE_ENV === NodeEnv.Production;

  return {
    nodeEnv: env.NODE_ENV,
    port: Number(env.PORT),
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
  };
}
