import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';

@Injectable()
export class CompetitionsService {
  constructor(private prisma: PrismaService) {}

  private async writeAudit(
    actorUserId: string | undefined,
    action: string,
    entityType: string,
    entityId?: string,
    payload?: unknown,
  ) {
    const delegate = (this.prisma as any).auditLog;
    if (!delegate) return;
    await delegate.create({
      data: {
        actorUserId: actorUserId ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        payload: payload ?? null,
      },
    });
  }

  async create(createCompetitionDto: CreateCompetitionDto, actorUserId?: string) {
    const competition = await this.prisma.competition.create({
      data: createCompetitionDto,
      include: {
        seasons: true,
      },
    });
    await this.writeAudit(actorUserId, 'COMPETITION_CREATE', 'Competition', competition.id, createCompetitionDto);
    return competition;
  }

  async findAll() {
    return this.prisma.competition.findMany({
      include: {
        _count: {
          select: {
            seasons: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const competition = await this.prisma.competition.findUnique({
      where: { id },
      include: {
        seasons: {
          include: {
            teams: {
              include: {
                team: true,
              },
            },
          },
        },
      },
    });

    if (!competition) {
      throw new NotFoundException(`Competition with ID ${id} not found`);
    }

    return competition;
  }

  async update(id: string, updateCompetitionDto: UpdateCompetitionDto, actorUserId?: string) {
    await this.findOne(id);

    const competition = await this.prisma.competition.update({
      where: { id },
      data: updateCompetitionDto,
      include: {
        seasons: true,
      },
    });
    await this.writeAudit(actorUserId, 'COMPETITION_UPDATE', 'Competition', id, updateCompetitionDto);
    return competition;
  }

  async remove(id: string, actorUserId?: string) {
    await this.findOne(id);

    const [seasonCount, fixtureCount, matchSessionCount] = await Promise.all([
      this.prisma.season.count({ where: { competitionId: id } }),
      this.prisma.fixtureMatch.count({ where: { season: { competitionId: id } } }),
      this.prisma.matchSession.count({ where: { fixtureMatch: { season: { competitionId: id } } } }),
    ]);

    const totalRefs = seasonCount + fixtureCount + matchSessionCount;
    if (totalRefs > 0) {
      await this.writeAudit(actorUserId, 'COMPETITION_DELETE_BLOCKED', 'Competition', id, {
        seasonCount,
        fixtureCount,
        matchSessionCount,
      });
      throw new ConflictException(
        `No se puede eliminar la liga porque tiene datos relacionados (temporadas:${seasonCount}, fixtures:${fixtureCount}, sesiones:${matchSessionCount}).`,
      );
    }

    await this.prisma.competition.delete({
      where: { id },
    });
    await this.writeAudit(actorUserId, 'COMPETITION_DELETE', 'Competition', id, {
      seasonCount,
      fixtureCount,
      matchSessionCount,
    });

    return { message: 'Competition deleted successfully' };
  }
}
