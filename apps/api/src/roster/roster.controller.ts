import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { RosterService } from './roster.service';
import { CreateRosterPlayerDto } from './dto/create-roster-player.dto';
import { UpdateRosterPlayerDto } from './dto/update-roster-player.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('matches/:matchId/roster')
@UseGuards(JwtAuthGuard)
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  @Post()
  create(@Param('matchId') matchId: string, @Body() createRosterPlayerDto: CreateRosterPlayerDto) {
    return this.rosterService.create(matchId, createRosterPlayerDto);
  }

  @Get()
  findAll(@Param('matchId') matchId: string) {
    return this.rosterService.findAll(matchId);
  }

  @Get(':rosterId')
  findOne(@Param('matchId') matchId: string, @Param('rosterId') rosterId: string) {
    return this.rosterService.findOne(matchId, rosterId);
  }

  @Patch(':rosterId')
  update(
    @Param('matchId') matchId: string,
    @Param('rosterId') rosterId: string,
    @Body() updateRosterPlayerDto: UpdateRosterPlayerDto,
  ) {
    return this.rosterService.update(matchId, rosterId, updateRosterPlayerDto);
  }

  @Delete(':rosterId')
  remove(@Param('matchId') matchId: string, @Param('rosterId') rosterId: string) {
    return this.rosterService.remove(matchId, rosterId);
  }
}
