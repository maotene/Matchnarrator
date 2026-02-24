import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AssignToSeasonDto } from './dto/assign-to-season.dto';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async create(createTeamDto: CreateTeamDto) {
    return this.prisma.team.create({
      data: createTeamDto,
    });
  }

  async findAll() {
    return this.prisma.team.findMany({
      include: {
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

  async update(id: string, updateTeamDto: UpdateTeamDto) {
    await this.findOne(id);

    return this.prisma.team.update({
      where: { id },
      data: updateTeamDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.team.delete({
      where: { id },
    });

    return { message: 'Team deleted successfully' };
  }

  async assignToSeason(id: string, assignToSeasonDto: AssignToSeasonDto) {
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

    return this.prisma.teamSeason.create({
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
  }
}
