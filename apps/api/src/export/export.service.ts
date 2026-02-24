import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  async exportMatch(matchId: string) {
    const match = await this.prisma.matchSession.findUnique({
      where: { id: matchId },
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
          orderBy: [
            {
              isHomeTeam: 'desc',
            },
            {
              jerseyNumber: 'asc',
            },
          ],
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
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    // Calculate stats
    const homeRoster = match.roster.filter((r) => r.isHomeTeam);
    const awayRoster = match.roster.filter((r) => !r.isHomeTeam);

    const homeEvents = match.events.filter((e) => e.teamSide === 'HOME');
    const awayEvents = match.events.filter((e) => e.teamSide === 'AWAY');

    const homeGoals = homeEvents.filter((e) => e.eventType === 'GOAL').length;
    const awayGoals = awayEvents.filter((e) => e.eventType === 'GOAL').length;

    const homeYellowCards = homeEvents.filter((e) => e.eventType === 'YELLOW_CARD').length;
    const awayYellowCards = awayEvents.filter((e) => e.eventType === 'YELLOW_CARD').length;

    const homeRedCards = homeEvents.filter((e) => e.eventType === 'RED_CARD').length;
    const awayRedCards = awayEvents.filter((e) => e.eventType === 'RED_CARD').length;

    // Build export object
    const exportData = {
      match: {
        id: match.id,
        matchDate: match.matchDate,
        venue: match.venue,
        status: match.status,
        currentPeriod: match.currentPeriod,
        elapsedSeconds: match.elapsedSeconds,
        firstHalfAddedTime: match.firstHalfAddedTime,
        secondHalfAddedTime: match.secondHalfAddedTime,
        createdAt: match.createdAt,
        updatedAt: match.updatedAt,
      },
      narrator: match.narrator,
      teams: {
        home: match.homeTeam,
        away: match.awayTeam,
      },
      roster: {
        home: homeRoster,
        away: awayRoster,
      },
      events: {
        all: match.events,
        home: homeEvents,
        away: awayEvents,
      },
      stats: {
        home: {
          goals: homeGoals,
          yellowCards: homeYellowCards,
          redCards: homeRedCards,
          totalEvents: homeEvents.length,
        },
        away: {
          goals: awayGoals,
          yellowCards: awayYellowCards,
          redCards: awayRedCards,
          totalEvents: awayEvents.length,
        },
      },
      score: {
        home: homeGoals,
        away: awayGoals,
      },
      exportedAt: new Date().toISOString(),
    };

    return exportData;
  }
}
