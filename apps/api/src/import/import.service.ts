import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PlayerPosition } from '@prisma/client';

const FOOTBALL_API_BASE = 'https://v3.football.api-sports.io';

const POSITION_MAP: Record<string, PlayerPosition | undefined> = {
  Goalkeeper: PlayerPosition.GK,
  Defender: PlayerPosition.DF,
  Midfielder: PlayerPosition.MF,
  Attacker: PlayerPosition.FW,
  Forward: PlayerPosition.FW,
};

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

@Injectable()
export class ImportService {
  private fixtureExternalIdColumnAvailable = true;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private resolveKey(headerKey?: string): string {
    const key = headerKey || this.config.get<string>('FOOTBALL_API_KEY');
    if (!key) {
      throw new BadRequestException(
        'API Football key required. Set FOOTBALL_API_KEY in .env or send x-football-api-key header.',
      );
    }
    return key;
  }

  private async fetchApi(path: string, apiKey: string): Promise<any> {
    const res = await fetch(`${FOOTBALL_API_BASE}${path}`, {
      headers: { 'x-apisports-key': apiKey },
    });
    if (!res.ok) {
      throw new BadRequestException(`API Football responded ${res.status}`);
    }
    const json: any = await res.json();
    if (json.errors && Object.keys(json.errors).length > 0) {
      const first = Object.values(json.errors)[0];
      throw new BadRequestException(`API Football: ${first}`);
    }
    return json;
  }

  private parseRoundNumber(roundLabel?: string | null): number | null {
    if (!roundLabel) return null;
    const match = roundLabel.match(/(\d+)(?!.*\d)/);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  }

  private isFinishedStatus(statusShort?: string | null): boolean {
    if (!statusShort) return false;
    return FINISHED_STATUSES.has(statusShort);
  }

  private normalizeKey(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
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

  private fixtureSupportsRoundLabel(): boolean {
    const fields = (this.prisma as any)?._runtimeDataModel?.models?.FixtureMatch?.fields;
    if (!Array.isArray(fields)) return true;
    return fields.some((field: any) => field?.name === 'roundLabel');
  }

  private isMissingFixtureExternalIdColumn(error: any): boolean {
    const message = String(error?.message ?? '');
    return message.includes('FixtureMatch.externalId');
  }

  // ── Leagues ────────────────────────────────────────────────────────────────

  async searchLeagues(opts: { query?: string; country?: string; apiKey?: string }) {
    const key = this.resolveKey(opts.apiKey);
    const params = new URLSearchParams();
    if (opts.query) params.set('search', opts.query);
    if (opts.country) params.set('country', opts.country);

    const data = await this.fetchApi(`/leagues?${params}`, key);

    return (data.response || []).map((item: any) => ({
      externalId: item.league.id,
      name: item.league.name,
      type: item.league.type,
      logo: item.league.logo,
      country: item.country.name,
      countryCode: item.country.code,
      countryFlag: item.country.flag,
      seasons: (item.seasons || [])
        .map((s: any) => ({ year: s.year, current: s.current }))
        .sort((a: any, b: any) => b.year - a.year),
    }));
  }

  async importLeague(body: {
    name: string;
    country: string;
    logo?: string;
    seasonYear: number;
    seasonName: string;
  }) {
    let competition = await this.prisma.competition.findFirst({
      where: { name: body.name },
    });
    if (!competition) {
      competition = await this.prisma.competition.create({
        data: { name: body.name, country: body.country, logo: body.logo },
      });
    }

    let season = await this.prisma.season.findFirst({
      where: { competitionId: competition.id, name: body.seasonName },
    });
    if (!season) {
      season = await this.prisma.season.create({
        data: {
          competitionId: competition.id,
          name: body.seasonName,
          startDate: new Date(body.seasonYear, 0, 1),
          endDate: new Date(body.seasonYear, 11, 31),
        },
      });
    }

    const seasonWithCompetition = await this.prisma.season.findUnique({
      where: { id: season.id },
      include: { competition: true },
    });

    return { competition, season: seasonWithCompetition };
  }

  // ── Teams ──────────────────────────────────────────────────────────────────

  async searchTeams(opts: { leagueId: string; season: string; apiKey?: string }) {
    const key = this.resolveKey(opts.apiKey);
    const data = await this.fetchApi(
      `/teams?league=${opts.leagueId}&season=${opts.season}`,
      key,
    );

    return (data.response || []).map((item: any) => ({
      externalId: item.team.id,
      name: item.team.name,
      shortName: item.team.code || null,
      logo: item.team.logo || null,
      city: item.venue?.city || null,
    }));
  }

  async importTeams(body: {
    seasonId: string;
    teams: Array<{ externalId?: number; name: string; shortName?: string; logo?: string; city?: string }>;
  }) {
    const results: { team: any; teamSeasonId: string; isNew: boolean; externalId: number | null }[] = [];

    for (const t of body.teams) {
      let isNew = false;
      let team = await this.prisma.team.findFirst({ where: { name: t.name } });
      if (!team) {
        team = await this.prisma.team.create({
          data: { name: t.name, shortName: t.shortName, logo: t.logo, city: t.city },
        });
        isNew = true;
      }

      let teamSeason = await this.prisma.teamSeason.findUnique({
        where: { teamId_seasonId: { teamId: team.id, seasonId: body.seasonId } },
      });
      if (!teamSeason) {
        teamSeason = await this.prisma.teamSeason.create({
          data: { teamId: team.id, seasonId: body.seasonId },
        });
      }

      results.push({
        team,
        teamSeasonId: teamSeason.id,
        isNew,
        externalId: typeof t.externalId === 'number' ? t.externalId : null,
      });
    }

    return results;
  }

  // ── Squad ──────────────────────────────────────────────────────────────────

  async searchSquad(opts: { teamId: string; season?: string; apiKey?: string }) {
    const key = this.resolveKey(opts.apiKey);
    const path = opts.season
      ? `/players/squads?team=${opts.teamId}&season=${opts.season}`
      : `/players/squads?team=${opts.teamId}`;
    const data = await this.fetchApi(path, key);

    const squad = data.response?.[0];
    if (!squad) return [];

    return (squad.players || []).map((p: any) => {
      const parts = (p.name || '').trim().split(/\s+/);
      const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || '';
      const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
      return {
        externalId: p.id,
        name: p.name,
        firstName,
        lastName,
        number: p.number,
        position: p.position,
        photo: p.photo,
        age: p.age,
      };
    });
  }

  async searchFixtures(opts: { leagueId: string; season: string; apiKey?: string }) {
    const key = this.resolveKey(opts.apiKey);
    const fixtures: any[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const params = new URLSearchParams();
      params.set('league', opts.leagueId);
      params.set('season', opts.season);
      params.set('page', String(page));

      const data = await this.fetchApi(`/fixtures?${params.toString()}`, key);
      fixtures.push(...(data.response || []));
      totalPages = data.paging?.total ?? page;
      page += 1;
    } while (page <= totalPages);

    return fixtures.map((item: any) => ({
      externalId: item.fixture?.id,
      matchDate: item.fixture?.date,
      venue: item.fixture?.venue?.name || null,
      round: this.parseRoundNumber(item.league?.round || null),
      roundLabel: item.league?.round || null,
      statusShort: item.fixture?.status?.short || null,
      statusLong: item.fixture?.status?.long || null,
      isFinished: this.isFinishedStatus(item.fixture?.status?.short || null),
      homeScore: item.goals?.home ?? null,
      awayScore: item.goals?.away ?? null,
      homeTeamExternalId: item.teams?.home?.id,
      awayTeamExternalId: item.teams?.away?.id,
    }));
  }

  async searchStandings(opts: { leagueId: string; season: string; apiKey?: string }) {
    const key = this.resolveKey(opts.apiKey);
    const params = new URLSearchParams();
    params.set('league', opts.leagueId);
    params.set('season', opts.season);

    const data = await this.fetchApi(`/standings?${params.toString()}`, key);
    const leagueNode = data.response?.[0]?.league;
    const blocks = leagueNode?.standings || [];
    const rows: any[] = [];

    for (const block of blocks) {
      const groupRows = Array.isArray(block) ? block : [];
      for (const row of groupRows) {
        rows.push({
          groupName: row.group || '',
          rank: row.rank ?? 0,
          points: row.points ?? 0,
          played: row.all?.played ?? 0,
          won: row.all?.win ?? 0,
          draw: row.all?.draw ?? 0,
          lost: row.all?.lose ?? 0,
          goalsFor: row.all?.goals?.for ?? 0,
          goalsAgainst: row.all?.goals?.against ?? 0,
          goalsDiff: row.goalsDiff ?? 0,
          form: row.form || null,
          status: row.status || null,
          description: row.description || null,
          teamExternalId: row.team?.id,
        });
      }
    }

    return rows;
  }

  private async importFixturesInternal(
    seasonId: string,
    fixtures: Array<{
      externalId: number;
      matchDate: string;
      venue?: string | null;
      round?: number | null;
      roundLabel?: string | null;
      statusShort?: string | null;
      statusLong?: string | null;
      isFinished?: boolean;
      homeScore?: number | null;
      awayScore?: number | null;
      homeTeamExternalId: number;
      awayTeamExternalId: number;
    }>,
    teamIdsByExternalId: Map<number, string>,
  ) {
    const summary = { created: 0, updated: 0, skipped: 0 };

    for (const fixture of fixtures) {
      const homeTeamId = teamIdsByExternalId.get(fixture.homeTeamExternalId);
      const awayTeamId = teamIdsByExternalId.get(fixture.awayTeamExternalId);
      if (!homeTeamId || !awayTeamId || !fixture.externalId || !fixture.matchDate) {
        summary.skipped += 1;
        continue;
      }

      const payload = {
        seasonId,
        homeTeamId,
        awayTeamId,
        matchDate: new Date(fixture.matchDate),
        venue: fixture.venue ?? null,
        round: fixture.round ?? null,
        statusShort: fixture.statusShort ?? null,
        statusLong: fixture.statusLong ?? null,
        homeScore: fixture.homeScore ?? null,
        awayScore: fixture.awayScore ?? null,
        isFinished: fixture.isFinished ?? false,
        ...(this.fixtureSupportsRoundLabel()
          ? { roundLabel: fixture.roundLabel ?? null }
          : {}),
      };

      let existing: { id: string } | null = null;
      if (this.fixtureExternalIdColumnAvailable) {
        try {
          existing = await this.prisma.fixtureMatch.findFirst({
            where: { externalId: fixture.externalId },
            select: { id: true },
          });
        } catch (error: any) {
          if (!this.isMissingFixtureExternalIdColumn(error)) throw error;
          this.fixtureExternalIdColumnAvailable = false;
          existing = await this.prisma.fixtureMatch.findFirst({
            where: {
              seasonId,
              homeTeamId,
              awayTeamId,
              matchDate: new Date(fixture.matchDate),
            },
            select: { id: true },
          });
        }
      } else {
        existing = await this.prisma.fixtureMatch.findFirst({
          where: {
            seasonId,
            homeTeamId,
            awayTeamId,
            matchDate: new Date(fixture.matchDate),
          },
          select: { id: true },
        });
      }

      if (existing) {
        await this.prisma.fixtureMatch.update({
          where: { id: existing.id },
          data: payload,
        });
        summary.updated += 1;
      } else {
        try {
          await this.prisma.fixtureMatch.create({
            data: this.fixtureExternalIdColumnAvailable
              ? {
                  externalId: fixture.externalId,
                  ...payload,
                }
              : payload,
          });
        } catch (error: any) {
          if (!this.isMissingFixtureExternalIdColumn(error)) throw error;
          this.fixtureExternalIdColumnAvailable = false;
          await this.prisma.fixtureMatch.create({ data: payload });
        }
        summary.created += 1;
      }
    }

    return summary;
  }

  private async importStandingsInternal(
    seasonId: string,
    rows: Array<{
      groupName: string;
      rank: number;
      points: number;
      played: number;
      won: number;
      draw: number;
      lost: number;
      goalsFor: number;
      goalsAgainst: number;
      goalsDiff: number;
      form?: string | null;
      status?: string | null;
      description?: string | null;
      teamExternalId: number;
    }>,
    teamIdsByExternalId: Map<number, string>,
  ) {
    const summary = { upserted: 0, skipped: 0 };
    const standingsDelegate = this.getSeasonStandingDelegate();

    for (const row of rows) {
      const teamId = teamIdsByExternalId.get(row.teamExternalId);
      if (!teamId) {
        summary.skipped += 1;
        continue;
      }

      const payload = {
        rank: row.rank,
        points: row.points,
        played: row.played,
        won: row.won,
        draw: row.draw,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalsDiff: row.goalsDiff,
        form: row.form ?? null,
        status: row.status ?? null,
        description: row.description ?? null,
      };

      const existing = await standingsDelegate.findFirst({
        where: {
          seasonId,
          teamId,
          groupName: row.groupName || '',
        },
      });

      if (existing) {
        await standingsDelegate.update({
          where: { id: existing.id },
          data: payload,
        });
      } else {
        await standingsDelegate.create({
          data: {
            seasonId,
            teamId,
            groupName: row.groupName || '',
            ...payload,
          },
        });
      }

      summary.upserted += 1;
    }

    return summary;
  }

  async importFullSeason(
    body: {
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
    apiKey?: string,
  ) {
    const shouldImportSquads = body.includeSquads !== false;
    const shouldImportFixtures = body.includeFixtures !== false;
    const shouldImportStandings = body.includeStandings !== false;

    const leagueImport = await this.importLeague({
      name: body.name,
      country: body.country,
      logo: body.logo,
      seasonYear: body.seasonYear,
      seasonName: body.seasonName,
    });

    const apiTeams = await this.searchTeams({
      leagueId: String(body.leagueId),
      season: String(body.seasonYear),
      apiKey,
    });

    const importedTeams = await this.importTeams({
      seasonId: leagueImport.season.id,
      teams: apiTeams.map((team) => ({
        externalId: team.externalId,
        name: team.name,
        shortName: team.shortName,
        logo: team.logo,
        city: team.city,
      })),
    });

    const teamIdsByExternalId = new Map<number, string>();
    for (const importedTeam of importedTeams) {
      if (importedTeam.externalId !== null) {
        teamIdsByExternalId.set(importedTeam.externalId, importedTeam.team.id);
      }
    }

    let squadTeamsProcessed = 0;
    let playersAssigned = 0;
    let squadErrors = 0;

    if (shouldImportSquads) {
      for (const team of apiTeams) {
        const importedTeam = importedTeams.find((it) => it.externalId === team.externalId);
        if (!importedTeam) continue;

        try {
          const squad = await this.searchSquad({
            teamId: String(team.externalId),
            season: String(body.seasonYear),
            apiKey,
          });

          if (squad.length === 0) continue;

          const squadImport = await this.importSquad({
            teamSeasonId: importedTeam.teamSeasonId,
            players: squad.map((player) => ({
              firstName: player.firstName,
              lastName: player.lastName,
              number: player.number,
              position: player.position,
              photo: player.photo,
            })),
          });

          squadTeamsProcessed += 1;
          playersAssigned += squadImport.filter((item) => item.assigned).length;
        } catch {
          squadErrors += 1;
        }
      }
    }

    let fixtureSummary = { created: 0, updated: 0, skipped: 0 };
    if (shouldImportFixtures) {
      const fixtures = await this.searchFixtures({
        leagueId: String(body.leagueId),
        season: String(body.seasonYear),
        apiKey,
      });

      fixtureSummary = await this.importFixturesInternal(
        leagueImport.season.id,
        fixtures,
        teamIdsByExternalId,
      );
    }

    let standingsSummary = { upserted: 0, skipped: 0 };
    if (shouldImportStandings) {
      const standings = await this.searchStandings({
        leagueId: String(body.leagueId),
        season: String(body.seasonYear),
        apiKey,
      });

      standingsSummary = await this.importStandingsInternal(
        leagueImport.season.id,
        standings,
        teamIdsByExternalId,
      );
    }

    return {
      competition: leagueImport.competition,
      season: leagueImport.season,
      teams: importedTeams,
      summary: {
        teams: importedTeams.length,
        squadTeamsProcessed,
        playersAssigned,
        squadErrors,
        fixturesCreated: fixtureSummary.created,
        fixturesUpdated: fixtureSummary.updated,
        fixturesSkipped: fixtureSummary.skipped,
        standingsUpserted: standingsSummary.upserted,
        standingsSkipped: standingsSummary.skipped,
      },
    };
  }

  async importManualSeason(body: {
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
  }) {
    if (!body?.competition?.name || !body?.season?.name) {
      throw new BadRequestException('competition.name and season.name are required');
    }
    if (!Array.isArray(body.teams) || body.teams.length === 0) {
      throw new BadRequestException('teams array is required');
    }

    let competition = await this.prisma.competition.findFirst({
      where: { name: body.competition.name },
    });
    if (!competition) {
      competition = await this.prisma.competition.create({
        data: {
          name: body.competition.name,
          country: body.competition.country ?? null,
          logo: body.competition.logo ?? null,
        },
      });
    } else if (body.competition.country || body.competition.logo) {
      competition = await this.prisma.competition.update({
        where: { id: competition.id },
        data: {
          country: body.competition.country ?? competition.country,
          logo: body.competition.logo ?? competition.logo,
        },
      });
    }

    let season = await this.prisma.season.findFirst({
      where: { competitionId: competition.id, name: body.season.name },
    });
    if (!season) {
      season = await this.prisma.season.create({
        data: {
          competitionId: competition.id,
          name: body.season.name,
          startDate: body.season.startDate ? new Date(body.season.startDate) : null,
          endDate: body.season.endDate ? new Date(body.season.endDate) : null,
        },
      });
    } else if (body.season.startDate || body.season.endDate) {
      season = await this.prisma.season.update({
        where: { id: season.id },
        data: {
          startDate: body.season.startDate ? new Date(body.season.startDate) : season.startDate,
          endDate: body.season.endDate ? new Date(body.season.endDate) : season.endDate,
        },
      });
    }

    const importedTeams = await this.importTeams({
      seasonId: season.id,
      teams: body.teams.map((team) => ({
        name: team.name,
        shortName: team.shortName,
        logo: team.logo,
        city: team.city,
      })),
    });

    const teamSeasonByName = new Map<string, { teamId: string; teamSeasonId: string }>();
    for (const importedTeam of importedTeams) {
      teamSeasonByName.set(this.normalizeKey(importedTeam.team.name), {
        teamId: importedTeam.team.id,
        teamSeasonId: importedTeam.teamSeasonId,
      });
    }

    let playersAssigned = 0;
    let teamsWithPlayers = 0;
    for (const team of body.teams) {
      const players = team.players ?? [];
      if (players.length === 0) continue;
      const teamInfo = teamSeasonByName.get(this.normalizeKey(team.name));
      if (!teamInfo) continue;

      const normalizedPlayers = players
        .map((player) => {
          let firstName = player.firstName?.trim() ?? '';
          let lastName = player.lastName?.trim() ?? '';
          if ((!firstName || !lastName) && player.name) {
            const parts = player.name.trim().split(/\s+/);
            firstName = firstName || (parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || '');
            lastName = lastName || (parts.length > 1 ? parts[parts.length - 1] : '');
          }
          if (!firstName) return null;
          return {
            firstName,
            lastName,
            number: player.number,
            position: player.position,
            photo: player.photo,
            nationality: player.nationality,
            birthDate: player.birthDate,
          };
        })
        .filter((p): p is NonNullable<typeof p> => Boolean(p));

      if (normalizedPlayers.length === 0) continue;

      const squadImport = await this.importSquad({
        teamSeasonId: teamInfo.teamSeasonId,
        players: normalizedPlayers,
      });
      playersAssigned += squadImport.filter((item) => item.assigned).length;
      teamsWithPlayers += 1;
    }

    let fixturesCreated = 0;
    let fixturesUpdated = 0;
    let fixturesSkipped = 0;

    for (const fixture of body.fixtures ?? []) {
      const home = teamSeasonByName.get(this.normalizeKey(fixture.homeTeam));
      const away = teamSeasonByName.get(this.normalizeKey(fixture.awayTeam));
      if (!home || !away || !fixture.matchDate) {
        fixturesSkipped += 1;
        continue;
      }

      const existing = await this.prisma.fixtureMatch.findFirst({
        where: {
          seasonId: season.id,
          homeTeamId: home.teamId,
          awayTeamId: away.teamId,
          matchDate: new Date(fixture.matchDate),
        },
      });

      const payload = {
        seasonId: season.id,
        homeTeamId: home.teamId,
        awayTeamId: away.teamId,
        matchDate: new Date(fixture.matchDate),
        venue: fixture.venue ?? null,
        round: fixture.round ?? null,
        statusShort: fixture.statusShort ?? null,
        statusLong: fixture.statusLong ?? null,
        homeScore: fixture.homeScore ?? null,
        awayScore: fixture.awayScore ?? null,
        isFinished: fixture.isFinished ?? false,
        ...(this.fixtureSupportsRoundLabel()
          ? { roundLabel: fixture.roundLabel ?? null }
          : {}),
      };

      if (existing) {
        await this.prisma.fixtureMatch.update({
          where: { id: existing.id },
          data: payload,
        });
        fixturesUpdated += 1;
      } else {
        await this.prisma.fixtureMatch.create({
          data: payload,
        });
        fixturesCreated += 1;
      }
    }

    let standingsUpserted = 0;
    let standingsSkipped = 0;
    const standings = this.getSeasonStandingDelegate();
    for (const row of body.standings ?? []) {
      const teamInfo = teamSeasonByName.get(this.normalizeKey(row.team));
      if (!teamInfo) {
        standingsSkipped += 1;
        continue;
      }

      const existing = await standings.findFirst({
        where: {
          seasonId: season.id,
          teamId: teamInfo.teamId,
          groupName: row.groupName ?? '',
        },
      });

      const payload = {
        seasonId: season.id,
        teamId: teamInfo.teamId,
        groupName: row.groupName ?? '',
        rank: row.rank,
        points: row.points,
        played: row.played,
        won: row.won,
        draw: row.draw,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalsDiff: row.goalsDiff,
        form: row.form ?? null,
        status: row.status ?? null,
        description: row.description ?? null,
      };

      if (existing) {
        await standings.update({
          where: { id: existing.id },
          data: payload,
        });
      } else {
        await standings.create({
          data: payload,
        });
      }
      standingsUpserted += 1;
    }

    const seasonWithCompetition = await this.prisma.season.findUnique({
      where: { id: season.id },
      include: { competition: true },
    });

    return {
      competition,
      season: seasonWithCompetition,
      teams: importedTeams,
      summary: {
        teams: importedTeams.length,
        teamsWithPlayers,
        playersAssigned,
        fixturesCreated,
        fixturesUpdated,
        fixturesSkipped,
        standingsUpserted,
        standingsSkipped,
      },
    };
  }

  async importSquad(body: {
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
  }) {
    const results: { player: any; assigned: boolean }[] = [];

    for (const p of body.players) {
      let player = await this.prisma.player.findFirst({
        where: { firstName: p.firstName, lastName: p.lastName },
      });
      if (!player) {
        player = await this.prisma.player.create({
          data: {
            firstName: p.firstName,
            lastName: p.lastName,
            photo: p.photo ?? null,
            nationality: p.nationality ?? null,
            birthDate: p.birthDate ? new Date(p.birthDate) : null,
            position: POSITION_MAP[p.position ?? ''] ?? null,
          },
        });
      }

      const existing = await this.prisma.playerSeason.findUnique({
        where: {
          playerId_teamSeasonId: {
            playerId: player.id,
            teamSeasonId: body.teamSeasonId,
          },
        },
      });
      if (!existing) {
        await this.prisma.playerSeason.create({
          data: {
            playerId: player.id,
            teamSeasonId: body.teamSeasonId,
            jerseyNumber: p.number ?? null,
          },
        });
      }

      results.push({ player, assigned: !existing });
    }

    return results;
  }
}
