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

  async findAll(narratorId: string, status?: MatchStatus) {
    return this.prisma.matchSession.findMany({
      where: {
        narratorId,
        ...(status && { status }),
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
            events: {
              where: {
                isDeleted: false,
              },
            },
          },
          orderBy: {
            isHomeTeam: 'desc',
          },
        },
        events: {
          where: {
            isDeleted: false,
          },
          orderBy: [
            {
              minute: 'asc',
            },
            {
              second: 'asc',
            },
          ],
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

    return match;
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

    if (match.status === MatchStatus.SETUP) {
      // First start → move to LIVE
      await this.prisma.matchSession.update({
        where: { id },
        data: {
          status: MatchStatus.LIVE,
          isTimerRunning: true,
          updatedAt: new Date(),
        },
      });
    } else {
      await this.prisma.matchSession.update({
        where: { id },
        data: {
          isTimerRunning: true,
          updatedAt: new Date(),
        },
      });
    }

    return { message: 'Timer started' };
  }

  async pauseTimer(id: string, userId: string, userRole: string) {
    const match = await this.findOne(id, userId, userRole);

    if (!match.isTimerRunning) {
      throw new BadRequestException('Timer is not running');
    }

    await this.prisma.matchSession.update({
      where: { id },
      data: {
        isTimerRunning: false,
        updatedAt: new Date(),
      },
    });

    return { message: 'Timer paused' };
  }

  async updateElapsedTime(id: string, userId: string, userRole: string, seconds: number) {
    await this.findOne(id, userId, userRole);

    await this.prisma.matchSession.update({
      where: { id },
      data: {
        elapsedSeconds: seconds,
      },
    });

    return { message: 'Elapsed time updated' };
  }

  async endPeriod(id: string, userId: string, userRole: string) {
    const match = await this.findOne(id, userId, userRole);

    let newStatus = match.status;
    let newPeriod = match.currentPeriod;

    if (match.currentPeriod === MatchPeriod.FIRST_HALF) {
      newStatus = MatchStatus.HALFTIME;
      newPeriod = MatchPeriod.SECOND_HALF;
    } else if (match.currentPeriod === MatchPeriod.SECOND_HALF) {
      newStatus = MatchStatus.FINISHED;
    }

    await this.prisma.matchSession.update({
      where: { id },
      data: {
        status: newStatus,
        currentPeriod: newPeriod,
        isTimerRunning: false,
        updatedAt: new Date(),
      },
    });

    return { message: 'Period ended', status: newStatus, period: newPeriod };
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
