import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { AssignToTeamDto } from './dto/assign-to-team.dto';

@Injectable()
export class PlayersService {
  constructor(private prisma: PrismaService) {}

  async create(createPlayerDto: CreatePlayerDto) {
    const data: any = {
      ...createPlayerDto,
    };

    if (createPlayerDto.birthDate) {
      data.birthDate = new Date(createPlayerDto.birthDate);
    }

    return this.prisma.player.create({
      data,
    });
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

  async update(id: string, updatePlayerDto: UpdatePlayerDto) {
    await this.findOne(id);

    const data: any = {
      ...updatePlayerDto,
    };

    if (updatePlayerDto.birthDate) {
      data.birthDate = new Date(updatePlayerDto.birthDate);
    }

    return this.prisma.player.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.player.delete({
      where: { id },
    });

    return { message: 'Player deleted successfully' };
  }

  async assignToTeam(id: string, assignToTeamDto: AssignToTeamDto) {
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

    return this.prisma.playerSeason.create({
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
  }
}
