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
        isStarter: createRosterPlayerDto.isStarter ?? true,
        position: createRosterPlayerDto.position,
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
