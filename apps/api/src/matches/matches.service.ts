import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { UpdateAddedTimeDto } from './dto/timer-action.dto';
import { MatchStatus, MatchPeriod } from '@prisma/client';

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService) {}

  private computeEffectiveElapsed(match: {
    elapsedSeconds: number;
    isTimerRunning: boolean;
    timerStartedAt?: Date | null;
  }) {
    if (!match.isTimerRunning || !match.timerStartedAt) return match.elapsedSeconds;
    const deltaSeconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(match.timerStartedAt).getTime()) / 1000),
    );
    return match.elapsedSeconds + deltaSeconds;
  }

  private parseSeasonYears(name: string): { startYear: number; endYear: number } | null {
    const trimmed = (name || '').trim();
    const single = trimmed.match(/^(\d{4})$/);
    if (single) {
      const year = Number(single[1]);
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

  private async findCurrentSeasonsForTeams(homeTeamId: string, awayTeamId: string) {
    const seasons = await this.prisma.season.findMany({
      where: {
        AND: [
          { teams: { some: { teamId: homeTeamId } } },
          { teams: { some: { teamId: awayTeamId } } },
        ],
      },
      include: {
        competition: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return seasons.filter((season) => this.resolveSeasonStatus(season) === 'CURRENT');
  }

  private async getCurrentSeasonIds() {
    const seasons = await this.prisma.season.findMany({
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    });
    return seasons
      .filter((season) => this.resolveSeasonStatus(season) === 'CURRENT')
      .map((season) => season.id);
  }

  private async resolveMatchCurrentSeason(match: {
    fixtureMatchId?: string | null;
    homeTeamId: string;
    awayTeamId: string;
  }) {
    if (match.fixtureMatchId) {
      const fixture = await this.prisma.fixtureMatch.findUnique({
        where: { id: match.fixtureMatchId },
        include: { season: { include: { competition: true } } },
      });
      if (!fixture) {
        throw new NotFoundException(`Fixture with ID ${match.fixtureMatchId} not found`);
      }
      const seasonStatus = this.resolveSeasonStatus(fixture.season);
      if (seasonStatus !== 'CURRENT') {
        throw new BadRequestException(
          `Cannot use squad from ${seasonStatus.toLowerCase()} season "${fixture.season.name}"`,
        );
      }
      return fixture.season;
    }

    const currentSeasons = await this.findCurrentSeasonsForTeams(
      match.homeTeamId,
      match.awayTeamId,
    );
    if (currentSeasons.length === 0) {
      throw new BadRequestException(
        'Both teams must be assigned to the same CURRENT season',
      );
    }
    return currentSeasons[0];
  }

  async create(narratorId: string, createMatchDto: CreateMatchDto) {
    // Validate teams exist
    const [homeTeam, awayTeam] = await Promise.all([
      this.prisma.team.findUnique({ where: { id: createMatchDto.homeTeamId } }),
      this.prisma.team.findUnique({ where: { id: createMatchDto.awayTeamId } }),
    ]);

    if (!homeTeam) {
      throw new NotFoundException(`Home team with ID ${createMatchDto.homeTeamId} not found`);
    }

    if (!awayTeam) {
      throw new NotFoundException(`Away team with ID ${createMatchDto.awayTeamId} not found`);
    }

    if (createMatchDto.homeTeamId === createMatchDto.awayTeamId) {
      throw new BadRequestException('Home and away teams must be different');
    }

    if (createMatchDto.fixtureMatchId) {
      const fixture = await this.prisma.fixtureMatch.findUnique({
        where: { id: createMatchDto.fixtureMatchId },
        include: {
          season: true,
        },
      });

      if (!fixture) {
        throw new NotFoundException(`Fixture with ID ${createMatchDto.fixtureMatchId} not found`);
      }

      if (
        fixture.homeTeamId !== createMatchDto.homeTeamId ||
        fixture.awayTeamId !== createMatchDto.awayTeamId
      ) {
        throw new BadRequestException(
          'homeTeamId/awayTeamId must match the selected fixture',
        );
      }

      const seasonStatus = this.resolveSeasonStatus(fixture.season);
      if (seasonStatus !== 'CURRENT') {
        throw new BadRequestException(
          `Cannot create live match from ${seasonStatus.toLowerCase()} season "${fixture.season.name}"`,
        );
      }

      if (fixture.statusShort === 'DIS') {
        throw new BadRequestException(
          'Este partido está deshabilitado por admin para esta fecha',
        );
      }
    } else {
      const currentSeasons = await this.findCurrentSeasonsForTeams(
        createMatchDto.homeTeamId,
        createMatchDto.awayTeamId,
      );

      if (currentSeasons.length === 0) {
        throw new BadRequestException(
          'Both teams must be assigned to the same CURRENT season to create a match without fixture',
        );
      }
    }

    return this.prisma.matchSession.create({
      data: {
        narratorId,
        homeTeamId: createMatchDto.homeTeamId,
        awayTeamId: createMatchDto.awayTeamId,
        matchDate: new Date(createMatchDto.matchDate),
        venue: createMatchDto.venue,
        fixtureMatchId: createMatchDto.fixtureMatchId,
      },
      include: {
        narrator: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        homeTeam: true,
        awayTeam: true,
      },
    });
  }

  async findAll(
    narratorId: string,
    status?: MatchStatus,
    userRole?: string,
    includeAll = false,
  ) {
    const currentSeasonIds = await this.getCurrentSeasonIds();
    if (currentSeasonIds.length === 0) {
      return [];
    }

    const canSeeAll = includeAll && userRole === 'SUPERADMIN';

    return this.prisma.matchSession.findMany({
      where: {
        ...(canSeeAll ? {} : { narratorId }),
        ...(status && { status }),
        OR: [
          {
            fixtureMatch: {
              seasonId: {
                in: currentSeasonIds,
              },
            },
          },
          {
            fixtureMatchId: null,
            homeTeam: {
              seasons: {
                some: {
                  seasonId: {
                    in: currentSeasonIds,
                  },
                },
              },
            },
            awayTeam: {
              seasons: {
                some: {
                  seasonId: {
                    in: currentSeasonIds,
                  },
                },
              },
            },
          },
        ],
      },
      include: {
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
        matchDate: 'desc',
      },
    });
  }

  async getSquadOptions(id: string, userId: string, userRole: string) {
    const match = await this.findOne(id, userId, userRole);
    const season = await this.resolveMatchCurrentSeason({
      fixtureMatchId: match.fixtureMatchId,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
    });

    const [homeTeamSeason, awayTeamSeason] = await Promise.all([
      this.prisma.teamSeason.findFirst({
        where: {
          seasonId: season.id,
          teamId: match.homeTeamId,
        },
        include: {
          players: {
            include: { player: true },
            orderBy: [
              { jerseyNumber: 'asc' },
              { player: { lastName: 'asc' } },
            ],
          },
        },
      }),
      this.prisma.teamSeason.findFirst({
        where: {
          seasonId: season.id,
          teamId: match.awayTeamId,
        },
        include: {
          players: {
            include: { player: true },
            orderBy: [
              { jerseyNumber: 'asc' },
              { player: { lastName: 'asc' } },
            ],
          },
        },
      }),
    ]);

    if (!homeTeamSeason || !awayTeamSeason) {
      throw new BadRequestException('Teams are not fully assigned to current season squads');
    }

    return {
      season: {
        id: season.id,
        name: season.name,
        competition: season.competition,
      },
      homeTeam: {
        id: match.homeTeam.id,
        name: match.homeTeam.name,
        squad: homeTeamSeason.players.map((entry) => ({
          playerId: entry.playerId,
          firstName: entry.player.firstName,
          lastName: entry.player.lastName,
          position: entry.player.position,
          defaultJersey: entry.jerseyNumber ?? 0,
        })),
      },
      awayTeam: {
        id: match.awayTeam.id,
        name: match.awayTeam.name,
        squad: awayTeamSeason.players.map((entry) => ({
          playerId: entry.playerId,
          firstName: entry.player.firstName,
          lastName: entry.player.lastName,
          position: entry.player.position,
          defaultJersey: entry.jerseyNumber ?? 0,
        })),
      },
    };
  }

  async findOne(id: string, userId: string, userRole: string) {
    const match = await this.prisma.matchSession.findUnique({
      where: { id },
      include: {
        narrator: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        homeTeam: true,
        awayTeam: true,
        roster: {
          include: {
            player: {
              select: { id: true, firstName: true, lastName: true, position: true },
            },
            events: {
              where: { isDeleted: false },
            },
          },
          orderBy: [{ isHomeTeam: 'desc' }, { jerseyNumber: 'asc' }],
        },
        events: {
          where: { isDeleted: false },
          include: {
            rosterPlayer: {
              select: {
                id: true,
                jerseyNumber: true,
                isHomeTeam: true,
                player: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
          orderBy: [{ minute: 'asc' }, { second: 'asc' }],
        },
      },
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${id} not found`);
    }

    // Check authorization: only narrator or SUPERADMIN
    if (match.narratorId !== userId && userRole !== 'SUPERADMIN') {
      throw new ForbiddenException('You do not have access to this match');
    }

    return {
      ...match,
      elapsedSeconds: this.computeEffectiveElapsed(match),
    };
  }

  async update(id: string, userId: string, userRole: string, updateMatchDto: UpdateMatchDto) {
    const match = await this.findOne(id, userId, userRole);

    const data: any = {};

    if (updateMatchDto.matchDate) {
      data.matchDate = new Date(updateMatchDto.matchDate);
    }

    if (updateMatchDto.venue !== undefined) {
      data.venue = updateMatchDto.venue;
    }

    if (updateMatchDto.status) {
      // Validate status transitions
      this.validateStatusTransition(match.status, updateMatchDto.status);
      data.status = updateMatchDto.status;
    }

    return this.prisma.matchSession.update({
      where: { id },
      data,
      include: {
        narrator: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        homeTeam: true,
        awayTeam: true,
      },
    });
  }

  async remove(id: string, userId: string, userRole: string) {
    await this.findOne(id, userId, userRole);

    await this.prisma.matchSession.delete({
      where: { id },
    });

    return { message: 'Match deleted successfully' };
  }

  // Timer methods
  async startTimer(id: string, userId: string, userRole: string) {
    const match = await this.findOne(id, userId, userRole);

    if (match.isTimerRunning) {
      throw new BadRequestException('Timer is already running');
    }

    const currentElapsed = match.elapsedSeconds;
    const nextStatus =
      match.status === MatchStatus.SETUP || match.status === MatchStatus.HALFTIME
        ? MatchStatus.LIVE
        : match.status;

    await this.prisma.matchSession.update({
      where: { id },
      data: {
        status: nextStatus,
        elapsedSeconds: currentElapsed,
        isTimerRunning: true,
        timerStartedAt: new Date(),
      },
    });

    return { message: 'Timer started' };
  }

  async pauseTimer(id: string, userId: string, userRole: string) {
    const match = await this.findOne(id, userId, userRole);

    if (!match.isTimerRunning) {
      throw new BadRequestException('Timer is not running');
    }

    const currentElapsed = match.elapsedSeconds;

    await this.prisma.matchSession.update({
      where: { id },
      data: {
        elapsedSeconds: currentElapsed,
        isTimerRunning: false,
        timerStartedAt: null,
      },
    });

    return { message: 'Timer paused' };
  }

  async updateElapsedTime(id: string, userId: string, userRole: string, seconds: number) {
    const match = await this.findOne(id, userId, userRole);

    await this.prisma.matchSession.update({
      where: { id },
      data: {
        elapsedSeconds: seconds,
        timerStartedAt: match.isTimerRunning ? new Date() : null,
      },
    });

    return { message: 'Elapsed time updated' };
  }

  async endPeriod(id: string, userId: string, userRole: string, force = false) {
    const match = await this.findOne(id, userId, userRole);
    const currentElapsed = match.elapsedSeconds;

    if (match.status === MatchStatus.FINISHED) {
      throw new BadRequestException('El partido ya está finalizado');
    }

    if (
      match.currentPeriod !== MatchPeriod.FIRST_HALF &&
      match.currentPeriod !== MatchPeriod.SECOND_HALF
    ) {
      throw new BadRequestException(
        `No se puede finalizar el período actual (${match.currentPeriod}) con esta acción`,
      );
    }

    const addedMinutes =
      match.currentPeriod === MatchPeriod.FIRST_HALF
        ? match.firstHalfAddedTime ?? 0
        : match.secondHalfAddedTime ?? 0;
    const requiredSeconds = 45 * 60 + addedMinutes * 60;

    if (currentElapsed < requiredSeconds && !force) {
      const missingSeconds = requiredSeconds - currentElapsed;
      const missingMinutes = Math.ceil(missingSeconds / 60);
      throw new BadRequestException(
        `Aún no se completaron los 45' del período (${missingMinutes} min restantes). Usa force=true para finalizar igualmente.`,
      );
    }

    let newStatus: MatchStatus = match.status as MatchStatus;
    let newPeriod: MatchPeriod = match.currentPeriod as MatchPeriod;
    let newElapsed = currentElapsed;

    if (match.currentPeriod === MatchPeriod.FIRST_HALF) {
      newStatus = MatchStatus.HALFTIME;
      newPeriod = MatchPeriod.SECOND_HALF;
      newElapsed = 0;
    } else if (match.currentPeriod === MatchPeriod.SECOND_HALF) {
      newStatus = MatchStatus.FINISHED;
      newElapsed = match.elapsedSeconds;
    }

    await this.prisma.matchSession.update({
      where: { id },
      data: {
        status: newStatus,
        currentPeriod: newPeriod,
        elapsedSeconds: newElapsed,
        isTimerRunning: false,
        timerStartedAt: null,
      },
    });

    return {
      message: 'Period ended',
      status: newStatus,
      period: newPeriod,
      forced: force,
    };
  }

  async updateAddedTime(
    id: string,
    userId: string,
    userRole: string,
    updateAddedTimeDto: UpdateAddedTimeDto,
  ) {
    await this.findOne(id, userId, userRole);

    await this.prisma.matchSession.update({
      where: { id },
      data: {
        firstHalfAddedTime: updateAddedTimeDto.firstHalfAddedTime,
        secondHalfAddedTime: updateAddedTimeDto.secondHalfAddedTime,
      },
    });

    return { message: 'Added time updated' };
  }

  // Helper methods
  private validateStatusTransition(currentStatus: MatchStatus, newStatus: MatchStatus) {
    const validTransitions: Record<MatchStatus, MatchStatus[]> = {
      [MatchStatus.SETUP]: [MatchStatus.LIVE],
      [MatchStatus.LIVE]: [MatchStatus.HALFTIME, MatchStatus.FINISHED],
      [MatchStatus.HALFTIME]: [MatchStatus.LIVE],
      [MatchStatus.FINISHED]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }
}
