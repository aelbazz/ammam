import { Injectable, NotFoundException } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto, PlanResponseDto, UpdatePlanDto } from './dto/billing.dto';

@Injectable()
export class PlanService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<PlanResponseDto[]> {
    const rows = await this.prisma.plan.findMany({ orderBy: { price: 'asc' } });
    return rows.map((p) => this.toDto(p));
  }

  async create(dto: CreatePlanDto): Promise<PlanResponseDto> {
    const plan = await this.prisma.plan.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        currency: dto.currency ?? 'USD',
        billingInterval: dto.billingInterval,
        active: dto.active ?? true,
        features: dto.features ?? [],
      },
    });
    return this.toDto(plan);
  }

  async update(id: string, dto: UpdatePlanDto): Promise<PlanResponseDto> {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Plan ${id} not found`);

    const plan = await this.prisma.plan.update({ where: { id }, data: dto });
    return this.toDto(plan);
  }

  private toDto(plan: Plan): PlanResponseDto {
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.price.toString(),
      currency: plan.currency,
      billingInterval: plan.billingInterval,
      active: plan.active,
      features: (plan.features as string[]) ?? [],
    };
  }
}
