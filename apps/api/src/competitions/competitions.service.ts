import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';

@Injectable()
export class CompetitionsService {
  constructor(private prisma: PrismaService) {}

  async create(createCompetitionDto: CreateCompetitionDto) {
    return this.prisma.competition.create({
      data: createCompetitionDto,
      include: {
        seasons: true,
      },
    });
  }

  async findAll() {
    return this.prisma.competition.findMany({
      include: {
        _count: {
          select: {
            seasons: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const competition = await this.prisma.competition.findUnique({
      where: { id },
      include: {
        seasons: {
          include: {
            teams: {
              include: {
                team: true,
              },
            },
          },
        },
      },
    });

    if (!competition) {
      throw new NotFoundException(`Competition with ID ${id} not found`);
    }

    return competition;
  }

  async update(id: string, updateCompetitionDto: UpdateCompetitionDto) {
    await this.findOne(id);

    return this.prisma.competition.update({
      where: { id },
      data: updateCompetitionDto,
      include: {
        seasons: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.competition.delete({
      where: { id },
    });

    return { message: 'Competition deleted successfully' };
  }
}
