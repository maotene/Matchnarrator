import { Controller, Get, Post, Body, Query, Headers, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ImportService } from './import.service';

@Controller('import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  /** Search leagues from API-Football */
  @Get('leagues')
  searchLeagues(
    @Query('q') query: string,
    @Query('country') country: string,
    @Headers('x-football-api-key') apiKey: string,
  ) {
    return this.importService.searchLeagues({ query, country, apiKey });
  }

  /** Save a league as Competition + Season in DB */
  @Post('leagues')
  importLeague(
    @Body() body: {
      name: string;
      country: string;
      logo?: string;
      seasonYear: number;
      seasonName: string;
    },
  ) {
    return this.importService.importLeague(body);
  }

  /** Import full season: league + teams + squads + fixtures/results */
  @Post('full-season')
  importFullSeason(
    @Body() body: {
      leagueId: number;
      name: string;
      country: string;
      logo?: string;
      seasonYear: number;
      seasonName: string;
      includeSquads?: boolean;
      includeFixtures?: boolean;
      includeStandings?: boolean;
    },
    @Headers('x-football-api-key') apiKey: string,
  ) {
    return this.importService.importFullSeason(body, apiKey);
  }

  /** Import full season manually from JSON (no external API) */
  @Post('manual-season')
  importManualSeason(
    @Body() body: {
      competition: { name: string; country?: string; logo?: string };
      season: { name: string; startDate?: string; endDate?: string };
      teams: Array<{
        name: string;
        shortName?: string;
        logo?: string;
        city?: string;
        players?: Array<{
          firstName?: string;
          lastName?: string;
          name?: string;
          number?: number;
          position?: string;
          photo?: string;
          nationality?: string;
          birthDate?: string;
        }>;
      }>;
      fixtures?: Array<{
        homeTeam: string;
        awayTeam: string;
        matchDate: string;
        venue?: string;
        round?: number;
        roundLabel?: string;
        statusShort?: string;
        statusLong?: string;
        homeScore?: number;
        awayScore?: number;
        isFinished?: boolean;
      }>;
      standings?: Array<{
        team: string;
        groupName?: string;
        rank: number;
        points: number;
        played: number;
        won: number;
        draw: number;
        lost: number;
        goalsFor: number;
        goalsAgainst: number;
        goalsDiff: number;
        form?: string;
        status?: string;
        description?: string;
      }>;
    },
  ) {
    return this.importService.importManualSeason(body);
  }

  /** Fetch teams for a league/season from API-Football */
  @Get('teams')
  searchTeams(
    @Query('leagueId') leagueId: string,
    @Query('season') season: string,
    @Headers('x-football-api-key') apiKey: string,
  ) {
    return this.importService.searchTeams({ leagueId, season, apiKey });
  }

  /** Save teams in DB and assign them to a season */
  @Post('teams')
  importTeams(
    @Body() body: {
      seasonId: string;
      teams: Array<{ externalId?: number; name: string; shortName?: string; logo?: string; city?: string }>;
    },
  ) {
    return this.importService.importTeams(body);
  }

  /** Fetch squad for a team from API-Football */
  @Get('squad')
  searchSquad(
    @Query('teamId') teamId: string,
    @Query('season') season: string,
    @Headers('x-football-api-key') apiKey: string,
  ) {
    return this.importService.searchSquad({ teamId, season, apiKey });
  }

  /** Save players in DB and assign them to a TeamSeason */
  @Post('squad')
  importSquad(
    @Body() body: {
      teamSeasonId: string;
      players: Array<{
        firstName: string;
        lastName: string;
        number?: number;
        position?: string;
        photo?: string;
        nationality?: string;
        birthDate?: string;
      }>;
    },
  ) {
    return this.importService.importSquad(body);
  }
}
