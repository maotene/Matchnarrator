import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('take') take?: string,
  ) {
    const delegate = (this.prisma as any).auditLog;
    if (!delegate) {
      return {
        items: [],
        message: 'AuditLog no disponible. Ejecuta migración y prisma generate.',
      };
    }

    const limit = Math.min(Math.max(Number(take || 100), 1), 500);
    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    if (actorUserId) where.actorUserId = actorUserId;

    const items = await delegate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return { items };
  }
}
