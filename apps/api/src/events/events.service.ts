import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventType, TeamSide, MatchPeriod } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async create(matchId: string, createEventDto: CreateEventDto) {
    // Verify match exists
    const match = await this.prisma.matchSession.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    // Verify roster player if provided
    if (createEventDto.rosterPlayerId) {
      const rosterPlayer = await this.prisma.matchRosterPlayer.findFirst({
        where: {
          id: createEventDto.rosterPlayerId,
          matchId,
        },
      });

      if (!rosterPlayer) {
        throw new NotFoundException(
          `Roster player with ID ${createEventDto.rosterPlayerId} not found in this match`,
        );
      }
    }

    return this.prisma.matchEvent.create({
      data: {
        matchId,
        rosterPlayerId: createEventDto.rosterPlayerId,
        teamSide: createEventDto.teamSide,
        eventType: createEventDto.eventType,
        period: createEventDto.period,
        minute: createEventDto.minute,
        second: createEventDto.second,
        payload: createEventDto.payload,
      },
      include: {
        rosterPlayer: true,
      },
    });
  }

  async findAll(
    matchId: string,
    teamSide?: TeamSide,
    eventType?: EventType,
    period?: MatchPeriod,
  ) {
    // Verify match exists
    const match = await this.prisma.matchSession.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    const where: any = {
      matchId,
      isDeleted: false,
    };

    if (teamSide) {
      where.teamSide = teamSide;
    }

    if (eventType) {
      where.eventType = eventType;
    }

    if (period) {
      where.period = period;
    }

    return this.prisma.matchEvent.findMany({
      where,
      include: {
        rosterPlayer: true,
      },
      orderBy: [
        {
          minute: 'asc',
        },
        {
          second: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });
  }

  async findOne(matchId: string, eventId: string) {
    const event = await this.prisma.matchEvent.findFirst({
      where: {
        id: eventId,
        matchId,
      },
      include: {
        rosterPlayer: true,
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found in match ${matchId}`);
    }

    return event;
  }

  async update(matchId: string, eventId: string, updateEventDto: UpdateEventDto) {
    await this.findOne(matchId, eventId);

    // Verify roster player if provided
    if (updateEventDto.rosterPlayerId) {
      const rosterPlayer = await this.prisma.matchRosterPlayer.findFirst({
        where: {
          id: updateEventDto.rosterPlayerId,
          matchId,
        },
      });

      if (!rosterPlayer) {
        throw new NotFoundException(
          `Roster player with ID ${updateEventDto.rosterPlayerId} not found in this match`,
        );
      }
    }

    return this.prisma.matchEvent.update({
      where: { id: eventId },
      data: updateEventDto,
      include: {
        rosterPlayer: true,
      },
    });
  }

  async remove(matchId: string, eventId: string) {
    await this.findOne(matchId, eventId);

    // Soft delete
    await this.prisma.matchEvent.update({
      where: { id: eventId },
      data: {
        isDeleted: true,
      },
    });

    return { message: 'Event deleted successfully' };
  }

  async restore(matchId: string, eventId: string) {
    const event = await this.prisma.matchEvent.findFirst({
      where: {
        id: eventId,
        matchId,
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found in match ${matchId}`);
    }

    if (!event.isDeleted) {
      throw new NotFoundException(`Event with ID ${eventId} is not deleted`);
    }

    await this.prisma.matchEvent.update({
      where: { id: eventId },
      data: {
        isDeleted: false,
      },
    });

    return { message: 'Event restored successfully' };
  }

  async getLastDeleted(matchId: string) {
    const match = await this.prisma.matchSession.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    return this.prisma.matchEvent.findFirst({
      where: {
        matchId,
        isDeleted: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        rosterPlayer: true,
      },
    });
  }
}
