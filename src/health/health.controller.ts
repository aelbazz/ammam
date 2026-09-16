import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorResult,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness and readiness probe',
    description: 'Includes a real database round-trip, so a 200 means the API can serve data.',
  })
  @ApiResponse({ status: 200, description: 'Healthy' })
  @ApiResponse({ status: 503, description: 'One or more checks failed' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.checkDatabase(),
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: 'up', responseTimeMs: Date.now() - startedAt } };
    } catch {
      // The driver error can contain the connection string; never surface it.
      return { database: { status: 'down', message: 'Database unreachable' } };
    }
  }
}
