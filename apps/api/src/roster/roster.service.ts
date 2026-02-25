import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRosterPlayerDto } from './dto/create-roster-player.dto';
import { UpdateRosterPlayerDto } from './dto/update-roster-player.dto';

@Injectable()
export class RosterService {
  constructor(private prisma: PrismaService) {}

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

  private async resolveMatchCurrentSeasonId(match: { id: string; homeTeamId: string; awayTeamId: string; fixtureMatchId?: string | null }) {
    if (match.fixtureMatchId) {
      const fixture = await this.prisma.fixtureMatch.findUnique({
        where: { id: match.fixtureMatchId },
        include: { season: true },
      });
      if (!fixture) {
        throw new NotFoundException(`Fixture with ID ${match.fixtureMatchId} not found`);
      }
      if (this.resolveSeasonStatus(fixture.season) !== 'CURRENT') {
        throw new BadRequestException(
          `Cannot edit roster from non-current season "${fixture.season.name}"`,
        );
      }
      return fixture.seasonId;
    }

    const seasons = await this.prisma.season.findMany({
      where: {
        AND: [
          { teams: { some: { teamId: match.homeTeamId } } },
          { teams: { some: { teamId: match.awayTeamId } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    const current = seasons.find((season) => this.resolveSeasonStatus(season) === 'CURRENT');
    if (!current) {
      throw new BadRequestException(
        'Match teams are not in the same CURRENT season; roster can only use current-season squads',
      );
    }
    return current.id;
  }

  async create(matchId: string, createRosterPlayerDto: CreateRosterPlayerDto) {
    // Verify match exists
    const match = await this.prisma.matchSession.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    // Verify player exists
    const player = await this.prisma.player.findUnique({
      where: { id: createRosterPlayerDto.playerId },
    });

    if (!player) {
      throw new NotFoundException(
        `Player with ID ${createRosterPlayerDto.playerId} not found`,
      );
    }

    // Verify team exists and matches home/away
    const team = await this.prisma.team.findUnique({
      where: { id: createRosterPlayerDto.teamId },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${createRosterPlayerDto.teamId} not found`);
    }

    const expectedTeamId = createRosterPlayerDto.isHomeTeam
      ? match.homeTeamId
      : match.awayTeamId;

    if (createRosterPlayerDto.teamId !== expectedTeamId) {
      throw new BadRequestException(
        `Team ID does not match ${createRosterPlayerDto.isHomeTeam ? 'home' : 'away'} team`,
      );
    }

    const seasonId = await this.resolveMatchCurrentSeasonId(match);
    const playerInSeasonSquad = await this.prisma.playerSeason.findFirst({
      where: {
        playerId: createRosterPlayerDto.playerId,
        teamSeason: {
          seasonId,
          teamId: createRosterPlayerDto.teamId,
        },
      },
      select: { id: true },
    });

    if (!playerInSeasonSquad) {
      throw new BadRequestException(
        'Player is not part of this team current-season squad',
      );
    }

    // Check if player already in roster
    const existing = await this.prisma.matchRosterPlayer.findUnique({
      where: {
        matchId_playerId: {
          matchId,
          playerId: createRosterPlayerDto.playerId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Player is already in the roster');
    }

    return this.prisma.matchRosterPlayer.create({
      data: {
        matchId,
        playerId: createRosterPlayerDto.playerId,
        teamId: createRosterPlayerDto.teamId,
        jerseyNumber: createRosterPlayerDto.jerseyNumber,
        isHomeTeam: createRosterPlayerDto.isHomeTeam,
        customName: createRosterPlayerDto.customName,
        isStarter: createRosterPlayerDto.isStarter ?? true,
        position: createRosterPlayerDto.position,
      },
      include: {
        player: { select: { id: true, firstName: true, lastName: true, position: true } },
      },
    });
  }

  async findAll(matchId: string) {
    // Verify match exists
    const match = await this.prisma.matchSession.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    return this.prisma.matchRosterPlayer.findMany({
      where: { matchId },
      orderBy: [
        {
          isHomeTeam: 'desc',
        },
        {
          jerseyNumber: 'asc',
        },
      ],
    });
  }

  async findOne(matchId: string, rosterId: string) {
    const rosterPlayer = await this.prisma.matchRosterPlayer.findFirst({
      where: {
        id: rosterId,
        matchId,
      },
    });

    if (!rosterPlayer) {
      throw new NotFoundException(
        `Roster player with ID ${rosterId} not found in match ${matchId}`,
      );
    }

    return rosterPlayer;
  }

  async update(matchId: string, rosterId: string, updateRosterPlayerDto: UpdateRosterPlayerDto) {
    await this.findOne(matchId, rosterId);

    return this.prisma.matchRosterPlayer.update({
      where: { id: rosterId },
      data: updateRosterPlayerDto,
    });
  }

  async remove(matchId: string, rosterId: string) {
    await this.findOne(matchId, rosterId);

    await this.prisma.matchRosterPlayer.delete({
      where: { id: rosterId },
    });

    return { message: 'Roster player removed successfully' };
  }
}
