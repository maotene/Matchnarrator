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
import { SeasonsService } from './seasons.service';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('seasons')
@UseGuards(JwtAuthGuard)
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  create(@CurrentUser() user: any, @Body() createSeasonDto: CreateSeasonDto) {
    return this.seasonsService.create(createSeasonDto, user?.id);
  }

  @Get()
  findAll(@Query('competitionId') competitionId?: string) {
    return this.seasonsService.findAll(competitionId);
  }

  @Get('current')
  findCurrent(@Query('competitionId') competitionId?: string) {
    return this.seasonsService.findCurrent(competitionId);
  }

  @Get('current/teams')
  findCurrentTeams(@Query('competitionId') competitionId?: string) {
    return this.seasonsService.findCurrentTeams(competitionId);
  }

  @Get('current/teams/:teamId/squad')
  findCurrentTeamSquad(
    @Param('teamId') teamId: string,
    @Query('competitionId') competitionId?: string,
  ) {
    return this.seasonsService.findCurrentTeamSquad(teamId, competitionId);
  }

  @Get('current/fixtures')
  findCurrentFixtures(@Query('competitionId') competitionId?: string) {
    return this.seasonsService.findCurrentFixtures(competitionId);
  }

  @Get('current/standings')
  findCurrentStandings(@Query('competitionId') competitionId?: string) {
    return this.seasonsService.findCurrentStandings(competitionId);
  }

  @Get('current/full')
  findCurrentFullSeasonData(@Query('competitionId') competitionId?: string) {
    return this.seasonsService.findCurrentFullSeasonData(competitionId);
  }

  @Get(':id/teams')
  findTeamsBySeason(@Param('id') id: string) {
    return this.seasonsService.findTeamsBySeason(id);
  }

  @Get(':id/teams/:teamId/squad')
  findSeasonTeamSquad(@Param('id') id: string, @Param('teamId') teamId: string) {
    return this.seasonsService.findSeasonTeamSquad(id, teamId);
  }

  @Get(':id/fixtures')
  findFixturesBySeason(@Param('id') id: string) {
    return this.seasonsService.findFixturesBySeason(id);
  }

  @Get(':id/standings')
  findStandingsBySeason(@Param('id') id: string) {
    return this.seasonsService.findStandingsBySeason(id);
  }

  @Get(':id/full')
  findFullSeasonData(@Param('id') id: string) {
    return this.seasonsService.findFullSeasonData(id);
  }

  @Patch(':id/fixtures/round/:round/availability')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  setRoundAvailability(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('round') round: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.seasonsService.setRoundAvailability(id, Number(round), Boolean(body?.enabled), user?.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.seasonsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() updateSeasonDto: UpdateSeasonDto) {
    return this.seasonsService.update(id, updateSeasonDto, user?.id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.seasonsService.remove(id, user?.id);
  }
}
