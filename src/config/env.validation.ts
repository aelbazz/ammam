import { Type, plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Environment contract. Validated once at startup so the process fails fast and loudly
 * rather than throwing on the first request that touches a missing variable.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  /**
   * Minimum 32 characters. A short secret is the single most common way a JWT deployment
   * gets broken, so it is enforced rather than documented.
   */
  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN = '7d';

  /** Comma-separated origin list. Never a wildcard in production - see main.ts. */
  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_TTL_SECONDS = 60;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_LIMIT = 120;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  AUTH_THROTTLE_LIMIT = 5;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  CONTACT_THROTTLE_LIMIT = 5;

  @IsString()
  @IsOptional()
  SWAGGER_ENABLED?: string;

  /** Seed-only. Not required at runtime; the seed script validates them separately. */
  @IsString()
  @IsOptional()
  ADMIN_EMAIL?: string;

  @IsString()
  @IsOptional()
  ADMIN_PASSWORD?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    excludeExtraneousValues: false,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    // Constraint messages never include the offending value, so no secret can leak here.
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return validated;
}
