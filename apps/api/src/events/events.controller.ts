import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventType, TeamSide, MatchPeriod } from '@prisma/client';

@Controller('matches/:matchId/events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(@Param('matchId') matchId: string, @Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(matchId, createEventDto);
  }

  @Get()
  findAll(
    @Param('matchId') matchId: string,
    @Query('teamSide') teamSide?: TeamSide,
    @Query('eventType') eventType?: EventType,
    @Query('period') period?: MatchPeriod,
  ) {
    return this.eventsService.findAll(matchId, teamSide, eventType, period);
  }

  @Get('last-deleted')
  getLastDeleted(@Param('matchId') matchId: string) {
    return this.eventsService.getLastDeleted(matchId);
  }

  @Get(':eventId')
  findOne(@Param('matchId') matchId: string, @Param('eventId') eventId: string) {
    return this.eventsService.findOne(matchId, eventId);
  }

  @Patch(':eventId')
  update(
    @Param('matchId') matchId: string,
    @Param('eventId') eventId: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.update(matchId, eventId, updateEventDto);
  }

  @Delete(':eventId')
  remove(@Param('matchId') matchId: string, @Param('eventId') eventId: string) {
    return this.eventsService.remove(matchId, eventId);
  }

  @Post(':eventId/restore')
  restore(@Param('matchId') matchId: string, @Param('eventId') eventId: string) {
    return this.eventsService.restore(matchId, eventId);
  }
}
