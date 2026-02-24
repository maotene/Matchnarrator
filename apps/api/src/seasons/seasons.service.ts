import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';

@Injectable()
export class SeasonsService {
  constructor(private prisma: PrismaService) {}

  async create(createSeasonDto: CreateSeasonDto) {
    return this.prisma.season.create({
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
  }

  async findAll(competitionId?: string) {
    return this.prisma.season.findMany({
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

  async update(id: string, updateSeasonDto: UpdateSeasonDto) {
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

    return this.prisma.season.update({
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
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.season.delete({
      where: { id },
    });

    return { message: 'Season deleted successfully' };
  }
}
