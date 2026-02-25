import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AssignToSeasonDto } from './dto/assign-to-season.dto';

@Injectable()
export class TeamsService {
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

  async create(createTeamDto: CreateTeamDto, actorUserId?: string) {
    const team = await this.prisma.team.create({
      data: createTeamDto,
    });
    await this.writeAudit(actorUserId, 'TEAM_CREATE', 'Team', team.id, createTeamDto);
    return team;
  }

  async findAll() {
    return this.prisma.team.findMany({
      include: {
        seasons: {
          include: {
            season: {
              include: {
                competition: true,
              },
            },
          },
          orderBy: {
            season: {
              name: 'desc',
            },
          },
        },
        _count: {
          select: {
            seasons: true,
            homeMatches: true,
            awayMatches: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        seasons: {
          include: {
            season: {
              include: {
                competition: true,
              },
            },
            players: {
              include: {
                player: true,
              },
            },
          },
        },
        homeMatches: {
          take: 10,
          orderBy: {
            matchDate: 'desc',
          },
        },
        awayMatches: {
          take: 10,
          orderBy: {
            matchDate: 'desc',
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    return team;
  }

  async update(id: string, updateTeamDto: UpdateTeamDto, actorUserId?: string) {
    await this.findOne(id);

    const team = await this.prisma.team.update({
      where: { id },
      data: updateTeamDto,
    });
    await this.writeAudit(actorUserId, 'TEAM_UPDATE', 'Team', id, updateTeamDto);
    return team;
  }

  async remove(id: string, actorUserId?: string) {
    await this.findOne(id);

    const [
      seasonsCount,
      standingsCount,
      homeSessionsCount,
      awaySessionsCount,
      fixtureHomeCount,
      fixtureAwayCount,
      rosterRefsCount,
    ] = await Promise.all([
      this.prisma.teamSeason.count({ where: { teamId: id } }),
      this.prisma.seasonStanding.count({ where: { teamId: id } }),
      this.prisma.matchSession.count({ where: { homeTeamId: id } }),
      this.prisma.matchSession.count({ where: { awayTeamId: id } }),
      this.prisma.fixtureMatch.count({ where: { homeTeamId: id } }),
      this.prisma.fixtureMatch.count({ where: { awayTeamId: id } }),
      this.prisma.matchRosterPlayer.count({ where: { teamId: id } }),
    ]);

    const totalReferences =
      seasonsCount +
      standingsCount +
      homeSessionsCount +
      awaySessionsCount +
      fixtureHomeCount +
      fixtureAwayCount +
      rosterRefsCount;

    if (totalReferences > 0) {
      await this.writeAudit(actorUserId, 'TEAM_DELETE_BLOCKED', 'Team', id, {
        seasonsCount,
        standingsCount,
        homeSessionsCount,
        awaySessionsCount,
        fixtureHomeCount,
        fixtureAwayCount,
        rosterRefsCount,
      });
      throw new ConflictException(
        `No se puede eliminar el equipo porque tiene datos relacionados (temporadas:${seasonsCount}, tabla:${standingsCount}, fixtures:${fixtureHomeCount + fixtureAwayCount}, sesiones:${homeSessionsCount + awaySessionsCount}, roster:${rosterRefsCount}). Usa editar o deshabilitar en lugar de borrar.`,
      );
    }

    await this.prisma.team.delete({
      where: { id },
    });
    await this.writeAudit(actorUserId, 'TEAM_DELETE', 'Team', id, {
      seasonsCount,
      standingsCount,
      homeSessionsCount,
      awaySessionsCount,
      fixtureHomeCount,
      fixtureAwayCount,
      rosterRefsCount,
    });

    return { message: 'Team deleted successfully' };
  }

  async assignToSeason(id: string, assignToSeasonDto: AssignToSeasonDto, actorUserId?: string) {
    await this.findOne(id);

    // Check if season exists
    const season = await this.prisma.season.findUnique({
      where: { id: assignToSeasonDto.seasonId },
    });

    if (!season) {
      throw new NotFoundException(
        `Season with ID ${assignToSeasonDto.seasonId} not found`,
      );
    }

    // Check if already assigned
    const existing = await this.prisma.teamSeason.findUnique({
      where: {
        teamId_seasonId: {
          teamId: id,
          seasonId: assignToSeasonDto.seasonId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Team is already assigned to this season');
    }

    const teamSeason = await this.prisma.teamSeason.create({
      data: {
        teamId: id,
        seasonId: assignToSeasonDto.seasonId,
      },
      include: {
        team: true,
        season: {
          include: {
            competition: true,
          },
        },
      },
    });
    await this.writeAudit(actorUserId, 'TEAM_ASSIGN_SEASON', 'TeamSeason', teamSeason.id, {
      teamId: id,
      seasonId: assignToSeasonDto.seasonId,
    });
    return teamSeason;
  }
}
