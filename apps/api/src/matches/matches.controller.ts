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
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { UpdateAddedTimeDto } from './dto/timer-action.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MatchStatus } from '@prisma/client';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() createMatchDto: CreateMatchDto) {
    return this.matchesService.create(user.id, createMatchDto);
  }

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('status') status?: MatchStatus,
    @Query('all') all?: string,
  ) {
    const includeAll = all === '1' || all === 'true';
    return this.matchesService.findAll(user.id, status, user.role, includeAll);
  }

  @Get(':id/squad-options')
  getSquadOptions(@CurrentUser() user: any, @Param('id') id: string) {
    return this.matchesService.getSquadOptions(id, user.id, user.role);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.matchesService.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateMatchDto: UpdateMatchDto,
  ) {
    return this.matchesService.update(id, user.id, user.role, updateMatchDto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.matchesService.remove(id, user.id, user.role);
  }

  // Timer endpoints
  @Post(':id/timer/start')
  startTimer(@CurrentUser() user: any, @Param('id') id: string) {
    return this.matchesService.startTimer(id, user.id, user.role);
  }

  @Post(':id/timer/pause')
  pauseTimer(@CurrentUser() user: any, @Param('id') id: string) {
    return this.matchesService.pauseTimer(id, user.id, user.role);
  }

  @Post(':id/timer/end-period')
  endPeriod(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { force?: boolean },
  ) {
    return this.matchesService.endPeriod(id, user.id, user.role, Boolean(body?.force));
  }

  @Patch(':id/timer/added-time')
  updateAddedTime(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateAddedTimeDto: UpdateAddedTimeDto,
  ) {
    return this.matchesService.updateAddedTime(id, user.id, user.role, updateAddedTimeDto);
  }

  @Patch(':id/timer/elapsed')
  updateElapsedTime(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { seconds: number },
  ) {
    return this.matchesService.updateElapsedTime(id, user.id, user.role, body.seconds);
  }
}
