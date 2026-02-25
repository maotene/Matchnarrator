import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';

@Injectable()
export class SeasonsService {
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

  private getSeasonStandingDelegate() {
    const delegate = (this.prisma as any).seasonStanding;
    if (!delegate) {
      throw new InternalServerErrorException(
        'Prisma Client desactualizado (falta seasonStanding). Ejecuta prisma generate y reinicia la API.',
      );
    }
    return delegate;
  }

  private parseSeasonYears(name: string): { startYear: number; endYear: number } | null {
    const trimmed = (name || '').trim();
    const singleYear = trimmed.match(/^(\d{4})$/);
    if (singleYear) {
      const year = Number(singleYear[1]);
      return { startYear: year, endYear: year };
    }

    const range = trimmed.match(/^(\d{4})\s*[-/]\s*(\d{2}|\d{4})$/);
    if (!range) return null;

    const startYear = Number(range[1]);
    const rawEnd = range[2];
    const endYear =
      rawEnd.length === 2
        ? Math.floor(startYear / 100) * 100 + Number(rawEnd)
        : Number(rawEnd);

    return { startYear, endYear };
  }

  private resolveSeasonStatus(
    season: { name: string; startDate?: Date | null; endDate?: Date | null },
    now = new Date(),
  ): 'CURRENT' | 'HISTORICAL' | 'UPCOMING' {
    if (season.startDate && season.endDate) {
      if (now >= season.startDate && now <= season.endDate) return 'CURRENT';
      return now > season.endDate ? 'HISTORICAL' : 'UPCOMING';
    }

    const years = this.parseSeasonYears(season.name);
    if (years) {
      const currentYear = now.getUTCFullYear();
      if (currentYear >= years.startYear && currentYear <= years.endYear) return 'CURRENT';
      return currentYear > years.endYear ? 'HISTORICAL' : 'UPCOMING';
    }

    return 'HISTORICAL';
  }

  private seasonSortScore(season: { name: string; startDate?: Date | null; endDate?: Date | null }) {
    if (season.endDate) return season.endDate.getTime();
    if (season.startDate) return season.startDate.getTime();

    const years = this.parseSeasonYears(season.name);
    if (years) {
      return Date.UTC(years.endYear, 11, 31);
    }

    return 0;
  }

  private async resolveCurrentSeasonOrThrow(competitionId?: string) {
    const seasons = await this.prisma.season.findMany({
      where: competitionId ? { competitionId } : undefined,
      include: {
        competition: true,
        _count: {
          select: {
            teams: true,
            fixtureMatches: true,
          },
        },
      },
    });

    const current = seasons.filter((s) => this.resolveSeasonStatus(s) === 'CURRENT');
    if (current.length === 0) {
      throw new NotFoundException(
        competitionId
          ? `No current season found for competition ${competitionId}`
          : 'No current season found',
      );
    }

    current.sort((a, b) => this.seasonSortScore(b) - this.seasonSortScore(a));
    const season = current[0];
    return { ...season, status: 'CURRENT' as const };
  }

  async create(createSeasonDto: CreateSeasonDto, actorUserId?: string) {
    const season = await this.prisma.season.create({
      data: {
        name: createSeasonDto.name,
        competitionId: createSeasonDto.competitionId,
        startDate: createSeasonDto.startDate ? new Date(createSeasonDto.startDate) : null,
        endDate: createSeasonDto.endDate ? new Date(createSeasonDto.endDate) : null,
      },
      include: {
        competition: true,
        teams: {
          include: {
            team: true,
          },
        },
      },
    });
    await this.writeAudit(actorUserId, 'SEASON_CREATE', 'Season', season.id, createSeasonDto);
    return season;
  }

  async findAll(competitionId?: string) {
    const seasons = await this.prisma.season.findMany({
      where: competitionId ? { competitionId } : undefined,
      include: {
        competition: true,
        _count: {
          select: {
            teams: true,
            fixtureMatches: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return seasons.map((season) => ({
      ...season,
      status: this.resolveSeasonStatus(season),
    }));
  }

  async findOne(id: string) {
    const season = await this.prisma.season.findUnique({
      where: { id },
      include: {
        competition: true,
        teams: {
          include: {
            team: true,
            players: {
              include: {
                player: true,
              },
            },
          },
        },
      },
    });

    if (!season) {
      throw new NotFoundException(`Season with ID ${id} not found`);
    }

    return season;
  }

  async findCurrent(competitionId?: string) {
    return this.resolveCurrentSeasonOrThrow(competitionId);
  }

  async findTeamsBySeason(seasonId: string) {
    await this.findOne(seasonId);
    const teams = await this.prisma.teamSeason.findMany({
      where: { seasonId },
      include: {
        team: true,
        _count: {
          select: {
            players: true,
          },
        },
      },
      orderBy: {
        teamId: 'asc',
      },
    });

    return teams.sort((a, b) => a.team.name.localeCompare(b.team.name));
  }

  async findCurrentTeams(competitionId?: string) {
    const current = await this.resolveCurrentSeasonOrThrow(competitionId);
    const teams = await this.findTeamsBySeason(current.id);
    return {
      season: current,
      teams,
    };
  }

  async findSeasonTeamSquad(seasonId: string, teamId: string) {
    const season = await this.findOne(seasonId);

    const teamSeason = await this.prisma.teamSeason.findFirst({
      where: { seasonId, teamId },
      include: {
        team: true,
        players: {
          include: {
            player: true,
          },
          orderBy: [
            { jerseyNumber: 'asc' },
            { player: { lastName: 'asc' } },
          ],
        },
      },
    });

    if (!teamSeason) {
      throw new NotFoundException(`Team ${teamId} is not assigned to season ${seasonId}`);
    }

    return {
      season: {
        id: season.id,
        name: season.name,
        competition: season.competition,
      },
      teamSeason,
    };
  }

  async findCurrentTeamSquad(teamId: string, competitionId?: string) {
    const current = await this.resolveCurrentSeasonOrThrow(competitionId);
    return this.findSeasonTeamSquad(current.id, teamId);
  }

  async findFixturesBySeason(seasonId: string) {
    await this.findOne(seasonId);
    const fixtures = await this.prisma.fixtureMatch.findMany({
      where: { seasonId },
      orderBy: [
        { matchDate: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const teamIds = [...new Set(fixtures.flatMap((f) => [f.homeTeamId, f.awayTeamId]))];
    const teams = await this.prisma.team.findMany({
      where: {
        id: { in: teamIds },
      },
    });
    const teamMap = new Map(teams.map((t) => [t.id, t]));

    return fixtures.map((fixture) => ({
      ...fixture,
      homeTeam: teamMap.get(fixture.homeTeamId) ?? null,
      awayTeam: teamMap.get(fixture.awayTeamId) ?? null,
    }));
  }

  async findCurrentFixtures(competitionId?: string) {
    const current = await this.resolveCurrentSeasonOrThrow(competitionId);
    const fixtures = await this.findFixturesBySeason(current.id);
    return {
      season: current,
      fixtures,
    };
  }

  async findStandingsBySeason(seasonId: string) {
    await this.findOne(seasonId);
    const standings = this.getSeasonStandingDelegate();
    return standings.findMany({
      where: { seasonId },
      include: {
        team: true,
      },
      orderBy: [
        { groupName: 'asc' },
        { rank: 'asc' },
      ],
    });
  }

  async findCurrentStandings(competitionId?: string) {
    const current = await this.resolveCurrentSeasonOrThrow(competitionId);
    const standings = await this.findStandingsBySeason(current.id);
    return {
      season: current,
      standings,
    };
  }

  async findFullSeasonData(seasonId: string) {
    const season = await this.findOne(seasonId);
    const [teams, fixtures, standings, sessions] = await Promise.all([
      this.findTeamsBySeason(seasonId),
      this.findFixturesBySeason(seasonId),
      this.findStandingsBySeason(seasonId),
      this.prisma.matchSession.findMany({
        where: {
          fixtureMatch: {
            seasonId,
          },
        },
        include: {
          narrator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          homeTeam: true,
          awayTeam: true,
          _count: {
            select: {
              roster: true,
              events: {
                where: {
                  isDeleted: false,
                },
              },
            },
          },
        },
        orderBy: {
          matchDate: 'asc',
        },
      }),
    ]);

    const sessionsByFixtureId = new Map<string, typeof sessions>();
    for (const session of sessions) {
      if (!session.fixtureMatchId) continue;
      const list = sessionsByFixtureId.get(session.fixtureMatchId) ?? [];
      list.push(session);
      sessionsByFixtureId.set(session.fixtureMatchId, list);
    }

    const fixturesWithSessions = fixtures.map((fixture: any) => ({
      ...fixture,
      matchSessions: sessionsByFixtureId.get(fixture.id) ?? [],
    }));

    return {
      season: {
        ...season,
        status: this.resolveSeasonStatus(season),
      },
      teams,
      fixtures: fixturesWithSessions,
      standings,
      summary: {
        teams: teams.length,
        fixtures: fixtures.length,
        standings: standings.length,
        matchSessions: sessions.length,
      },
    };
  }

  async findCurrentFullSeasonData(competitionId?: string) {
    const current = await this.resolveCurrentSeasonOrThrow(competitionId);
    return this.findFullSeasonData(current.id);
  }

  private applyFixtureAvailabilityStatus(
    fixture: { statusShort: string | null; isFinished: boolean; homeScore: number | null; awayScore: number | null },
    enabled: boolean,
  ) {
    if (!enabled) {
      return {
        statusShort: 'DIS',
        statusLong: 'Disabled by admin',
        isFinished: false,
      };
    }

    const hasScore = fixture.homeScore !== null || fixture.awayScore !== null;
    if (fixture.isFinished || hasScore) {
      return {
        statusShort: 'FT',
        statusLong: 'Match Finished',
        isFinished: true,
      };
    }

    return {
      statusShort: 'NS',
      statusLong: 'Not Started',
      isFinished: false,
    };
  }

  async setRoundAvailability(seasonId: string, round: number, enabled: boolean, actorUserId?: string) {
    await this.findOne(seasonId);
    const fixtures = await this.prisma.fixtureMatch.findMany({
      where: {
        seasonId,
        round,
      },
    });

    for (const fixture of fixtures) {
      await this.prisma.fixtureMatch.update({
        where: { id: fixture.id },
        data: this.applyFixtureAvailabilityStatus(fixture, enabled),
      });
    }

    const result = {
      seasonId,
      round,
      enabled,
      updated: fixtures.length,
    };
    await this.writeAudit(actorUserId, 'SEASON_ROUND_AVAILABILITY', 'Season', seasonId, result);
    return result;
  }

  async update(id: string, updateSeasonDto: UpdateSeasonDto, actorUserId?: string) {
    await this.findOne(id);

    const data: any = {
      ...updateSeasonDto,
    };

    if (updateSeasonDto.startDate) {
      data.startDate = new Date(updateSeasonDto.startDate);
    }

    if (updateSeasonDto.endDate) {
      data.endDate = new Date(updateSeasonDto.endDate);
    }

    const season = await this.prisma.season.update({
      where: { id },
      data,
      include: {
        competition: true,
        teams: {
          include: {
            team: true,
          },
        },
      },
    });
    await this.writeAudit(actorUserId, 'SEASON_UPDATE', 'Season', id, updateSeasonDto);
    return season;
  }

  async remove(id: string, actorUserId?: string) {
    await this.findOne(id);

    const [teamsCount, standingsCount, fixturesCount, sessionsCount] = await Promise.all([
      this.prisma.teamSeason.count({ where: { seasonId: id } }),
      this.getSeasonStandingDelegate().count({ where: { seasonId: id } }),
      this.prisma.fixtureMatch.count({ where: { seasonId: id } }),
      this.prisma.matchSession.count({ where: { fixtureMatch: { seasonId: id } } }),
    ]);

    const totalRefs = teamsCount + standingsCount + fixturesCount + sessionsCount;
    if (totalRefs > 0) {
      await this.writeAudit(actorUserId, 'SEASON_DELETE_BLOCKED', 'Season', id, {
        teamsCount,
        standingsCount,
        fixturesCount,
        sessionsCount,
      });
      throw new ConflictException(
        `No se puede eliminar la temporada porque tiene datos relacionados (equipos:${teamsCount}, tabla:${standingsCount}, fixtures:${fixturesCount}, sesiones:${sessionsCount}).`,
      );
    }

    await this.prisma.season.delete({
      where: { id },
    });
    await this.writeAudit(actorUserId, 'SEASON_DELETE', 'Season', id, {
      teamsCount,
      standingsCount,
      fixturesCount,
      sessionsCount,
    });

    return { message: 'Season deleted successfully' };
  }
}
