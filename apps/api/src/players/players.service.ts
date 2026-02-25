import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { AssignToTeamDto } from './dto/assign-to-team.dto';
import { EventType, PlayerPosition } from '@prisma/client';

@Injectable()
export class PlayersService {
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

  private normalizeKey(value: string) {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private parseName(input: { firstName?: string; lastName?: string; name?: string }) {
    let firstName = input.firstName?.trim() ?? '';
    let lastName = input.lastName?.trim() ?? '';

    if ((!firstName || !lastName) && input.name) {
      const parts = input.name.trim().split(/\s+/);
      firstName = firstName || (parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || '');
      lastName = lastName || (parts.length > 1 ? parts[parts.length - 1] : '');
    }

    return {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    };
  }

  private normalizePosition(position?: string): PlayerPosition | null {
    if (!position) return null;
    const p = position.trim().toUpperCase();
    if (p === 'GK' || p === 'POR' || p === 'PO' || p === 'GOALKEEPER' || p === 'ARQUERO') return PlayerPosition.GK;
    if (p === 'DF' || p === 'DEF' || p === 'DEFENDER' || p === 'DEFENSA') return PlayerPosition.DF;
    if (p === 'MF' || p === 'MID' || p === 'MED' || p === 'MIDFIELDER' || p === 'MEDIOCAMPISTA') return PlayerPosition.MF;
    if (p === 'FW' || p === 'ATT' || p === 'DEL' || p === 'FORWARD' || p === 'ATTACKER' || p === 'DELANTERO') return PlayerPosition.FW;
    return null;
  }

  private computeStats(events: Array<{ eventType: EventType; isDeleted: boolean }>) {
    const activeEvents = events.filter((e) => !e.isDeleted);
    return {
      goals: activeEvents.filter((e) => e.eventType === EventType.GOAL).length,
      yellowCards: activeEvents.filter((e) => e.eventType === EventType.YELLOW_CARD).length,
      redCards: activeEvents.filter((e) => e.eventType === EventType.RED_CARD).length,
      shots: activeEvents.filter((e) => e.eventType === EventType.SHOT).length,
      passes: activeEvents.filter((e) => e.eventType === EventType.PASS).length,
    };
  }

  async create(createPlayerDto: CreatePlayerDto, actorUserId?: string) {
    const data: any = {
      ...createPlayerDto,
    };

    if (createPlayerDto.birthDate) {
      data.birthDate = new Date(createPlayerDto.birthDate);
    }

    const player = await this.prisma.player.create({
      data,
    });
    await this.writeAudit(actorUserId, 'PLAYER_CREATE', 'Player', player.id, createPlayerDto);
    return player;
  }

  async findAll() {
    return this.prisma.player.findMany({
      include: {
        seasons: {
          include: {
            teamSeason: {
              include: {
                team: true,
                season: {
                  include: {
                    competition: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        {
          lastName: 'asc',
        },
        {
          firstName: 'asc',
        },
      ],
    });
  }

  async findOne(id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: {
        seasons: {
          include: {
            teamSeason: {
              include: {
                team: true,
                season: {
                  include: {
                    competition: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }

    return player;
  }

  async update(id: string, updatePlayerDto: UpdatePlayerDto, actorUserId?: string) {
    await this.findOne(id);

    const data: any = {
      ...updatePlayerDto,
    };

    if (updatePlayerDto.birthDate) {
      data.birthDate = new Date(updatePlayerDto.birthDate);
    }

    const player = await this.prisma.player.update({
      where: { id },
      data,
    });
    await this.writeAudit(actorUserId, 'PLAYER_UPDATE', 'Player', id, updatePlayerDto);
    return player;
  }

  async remove(id: string, actorUserId?: string) {
    await this.findOne(id);

    const [seasonRefs, rosterRefs] = await Promise.all([
      this.prisma.playerSeason.count({ where: { playerId: id } }),
      this.prisma.matchRosterPlayer.count({ where: { playerId: id } }),
    ]);

    const totalRefs = seasonRefs + rosterRefs;

    if (totalRefs > 0) {
      await this.writeAudit(actorUserId, 'PLAYER_DELETE_BLOCKED', 'Player', id, {
        seasonRefs,
        rosterRefs,
      });
      throw new ConflictException(
        `No se puede eliminar el jugador porque tiene datos relacionados (plantillas:${seasonRefs}, alineaciones:${rosterRefs}).`,
      );
    }

    await this.prisma.player.delete({
      where: { id },
    });
    await this.writeAudit(actorUserId, 'PLAYER_DELETE', 'Player', id, {
      seasonRefs,
      rosterRefs,
    });

    return { message: 'Player deleted successfully' };
  }

  async assignToTeam(id: string, assignToTeamDto: AssignToTeamDto, actorUserId?: string) {
    await this.findOne(id);

    // Check if team season exists
    const teamSeason = await this.prisma.teamSeason.findUnique({
      where: { id: assignToTeamDto.teamSeasonId },
    });

    if (!teamSeason) {
      throw new NotFoundException(
        `TeamSeason with ID ${assignToTeamDto.teamSeasonId} not found`,
      );
    }

    // Check if already assigned
    const existing = await this.prisma.playerSeason.findUnique({
      where: {
        playerId_teamSeasonId: {
          playerId: id,
          teamSeasonId: assignToTeamDto.teamSeasonId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Player is already assigned to this team season');
    }

    const playerSeason = await this.prisma.playerSeason.create({
      data: {
        playerId: id,
        teamSeasonId: assignToTeamDto.teamSeasonId,
        jerseyNumber: assignToTeamDto.jerseyNumber,
      },
      include: {
        player: true,
        teamSeason: {
          include: {
            team: true,
            season: {
              include: {
                competition: true,
              },
            },
          },
        },
      },
    });
    await this.writeAudit(actorUserId, 'PLAYER_ASSIGN_TEAM', 'PlayerSeason', playerSeason.id, {
      playerId: id,
      teamSeasonId: assignToTeamDto.teamSeasonId,
      jerseyNumber: assignToTeamDto.jerseyNumber,
    });
    return playerSeason;
  }

  async bulkImport(body: {
    seasonId: string;
    clearExistingForTeams?: boolean;
    teams: Array<{
      teamSeasonId?: string;
      teamName?: string;
      players: Array<{
        firstName?: string;
        lastName?: string;
        name?: string;
        jerseyNumber?: number;
        position?: string;
        nationality?: string;
        birthDate?: string;
        photo?: string;
      }>;
    }>;
  }) {
    if (!body?.seasonId) {
      throw new BadRequestException('seasonId is required');
    }
    if (!Array.isArray(body.teams) || body.teams.length === 0) {
      throw new BadRequestException('teams[] is required');
    }

    const season = await this.prisma.season.findUnique({
      where: { id: body.seasonId },
      include: { competition: true },
    });
    if (!season) throw new NotFoundException(`Season with ID ${body.seasonId} not found`);

    const teamSeasons = await this.prisma.teamSeason.findMany({
      where: { seasonId: body.seasonId },
      include: { team: true },
    });
    const byId = new Map(teamSeasons.map((ts) => [ts.id, ts]));
    const byName = new Map(teamSeasons.map((ts) => [this.normalizeKey(ts.team.name), ts]));

    let teamsProcessed = 0;
    let playersCreated = 0;
    let assignmentsCreated = 0;
    let assignmentsUpdated = 0;
    let skippedPlayers = 0;

    const teamResults: Array<{
      teamSeasonId: string;
      team: string;
      imported: number;
      createdPlayers: number;
      createdAssignments: number;
      updatedAssignments: number;
      skipped: number;
    }> = [];

    for (const teamInput of body.teams) {
      let teamSeason = teamInput.teamSeasonId ? byId.get(teamInput.teamSeasonId) : undefined;
      if (!teamSeason && teamInput.teamName) {
        teamSeason = byName.get(this.normalizeKey(teamInput.teamName));
      }
      if (!teamSeason) {
        throw new NotFoundException(
          `TeamSeason not found for teamSeasonId="${teamInput.teamSeasonId ?? ''}" teamName="${teamInput.teamName ?? ''}" in season ${season.name}`,
        );
      }

      teamsProcessed += 1;

      if (body.clearExistingForTeams) {
        await this.prisma.playerSeason.deleteMany({
          where: { teamSeasonId: teamSeason.id },
        });
      }

      let imported = 0;
      let teamCreatedPlayers = 0;
      let teamCreatedAssignments = 0;
      let teamUpdatedAssignments = 0;
      let teamSkipped = 0;

      for (const playerInput of teamInput.players ?? []) {
        const parsed = this.parseName(playerInput);
        if (!parsed.firstName) {
          skippedPlayers += 1;
          teamSkipped += 1;
          continue;
        }

        let player = await this.prisma.player.findFirst({
          where: {
            firstName: parsed.firstName,
            lastName: parsed.lastName || '',
          },
        });

        if (!player) {
          player = await this.prisma.player.create({
            data: {
              firstName: parsed.firstName,
              lastName: parsed.lastName || '',
              position: this.normalizePosition(playerInput.position),
              nationality: playerInput.nationality ?? null,
              photo: playerInput.photo ?? null,
              birthDate: playerInput.birthDate ? new Date(playerInput.birthDate) : null,
            },
          });
          playersCreated += 1;
          teamCreatedPlayers += 1;
        } else if (playerInput.position || playerInput.nationality || playerInput.photo || playerInput.birthDate) {
          player = await this.prisma.player.update({
            where: { id: player.id },
            data: {
              position: this.normalizePosition(playerInput.position) ?? player.position,
              nationality: playerInput.nationality ?? player.nationality,
              photo: playerInput.photo ?? player.photo,
              birthDate: playerInput.birthDate ? new Date(playerInput.birthDate) : player.birthDate,
            },
          });
        }

        const existing = await this.prisma.playerSeason.findUnique({
          where: {
            playerId_teamSeasonId: {
              playerId: player.id,
              teamSeasonId: teamSeason.id,
            },
          },
        });

        if (existing) {
          await this.prisma.playerSeason.update({
            where: { id: existing.id },
            data: {
              jerseyNumber:
                playerInput.jerseyNumber !== undefined ? playerInput.jerseyNumber : existing.jerseyNumber,
            },
          });
          assignmentsUpdated += 1;
          teamUpdatedAssignments += 1;
        } else {
          await this.prisma.playerSeason.create({
            data: {
              playerId: player.id,
              teamSeasonId: teamSeason.id,
              jerseyNumber: playerInput.jerseyNumber ?? null,
            },
          });
          assignmentsCreated += 1;
          teamCreatedAssignments += 1;
        }

        imported += 1;
      }

      teamResults.push({
        teamSeasonId: teamSeason.id,
        team: teamSeason.team.name,
        imported,
        createdPlayers: teamCreatedPlayers,
        createdAssignments: teamCreatedAssignments,
        updatedAssignments: teamUpdatedAssignments,
        skipped: teamSkipped,
      });
    }

    return {
      season: {
        id: season.id,
        name: season.name,
        competition: season.competition,
      },
      summary: {
        teamsProcessed,
        playersCreated,
        assignmentsCreated,
        assignmentsUpdated,
        skippedPlayers,
      },
      teams: teamResults,
    };
  }

  async getSummary(id: string, seasonId?: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: {
        seasons: {
          include: {
            teamSeason: {
              include: {
                team: true,
                season: {
                  include: {
                    competition: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }

    const scopedAssignments = seasonId
      ? player.seasons.filter((ps) => ps.teamSeason.seasonId === seasonId)
      : player.seasons;

    const scopedTeamIds = [...new Set(scopedAssignments.map((ps) => ps.teamSeason.teamId))];
    const scopedSeasonIds = [...new Set(scopedAssignments.map((ps) => ps.teamSeason.seasonId))];

    const rosterEntries = await this.prisma.matchRosterPlayer.findMany({
      where: {
        playerId: id,
        ...(seasonId
          ? {
              OR: [
                { match: { fixtureMatch: { seasonId } } },
                ...(scopedTeamIds.length > 0 ? [{ teamId: { in: scopedTeamIds } }] : []),
              ],
            }
          : {}),
      },
      include: {
        events: true,
        match: {
          select: {
            id: true,
            matchDate: true,
            fixtureMatch: {
              select: {
                seasonId: true,
              },
            },
          },
        },
      },
    });

    const matchesPlayed = new Set(rosterEntries.map((r) => r.matchId)).size;
    const allEvents = rosterEntries.flatMap((r) => r.events);
    const totals = this.computeStats(allEvents);

    const positionCounter = new Map<string, number>();
    for (const roster of rosterEntries) {
      if (!roster.position) continue;
      positionCounter.set(roster.position, (positionCounter.get(roster.position) ?? 0) + 1);
    }
    const positions = [...positionCounter.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([position, appearances]) => ({ position, appearances }));

    const bySeason = scopedAssignments.map((assignment) => {
      const season = assignment.teamSeason.season;
      const team = assignment.teamSeason.team;

      const seasonRoster = rosterEntries.filter((r) => {
        const fixtureSeasonId = r.match.fixtureMatch?.seasonId;
        if (fixtureSeasonId) {
          return fixtureSeasonId === season.id && r.teamId === team.id;
        }

        if (season.startDate && season.endDate) {
          return (
            r.teamId === team.id &&
            r.match.matchDate >= season.startDate &&
            r.match.matchDate <= season.endDate
          );
        }

        return r.teamId === team.id && scopedSeasonIds.includes(season.id);
      });

      const seasonEvents = seasonRoster.flatMap((r) => r.events);
      const seasonStats = this.computeStats(seasonEvents);

      return {
        season: {
          id: season.id,
          name: season.name,
          competition: {
            id: season.competition.id,
            name: season.competition.name,
          },
        },
        team: {
          id: team.id,
          name: team.name,
          shortName: team.shortName,
          logo: team.logo,
        },
        jerseyNumber: assignment.jerseyNumber,
        appearances: new Set(seasonRoster.map((r) => r.matchId)).size,
        ...seasonStats,
      };
    });

    return {
      player: {
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        photo: player.photo,
        nationality: player.nationality,
        birthDate: player.birthDate,
        mainPosition: player.position,
      },
      scope: {
        seasonId: seasonId ?? null,
      },
      totals: {
        matchesPlayed,
        ...totals,
      },
      positions,
      bySeason,
    };
  }
}
