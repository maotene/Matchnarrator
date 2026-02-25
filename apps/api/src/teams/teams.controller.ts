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
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AssignToSeasonDto } from './dto/assign-to-season.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  create(@CurrentUser() user: any, @Body() createTeamDto: CreateTeamDto) {
    return this.teamsService.create(createTeamDto, user?.id);
  }

  @Get()
  findAll() {
    return this.teamsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() updateTeamDto: UpdateTeamDto) {
    return this.teamsService.update(id, updateTeamDto, user?.id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.teamsService.remove(id, user?.id);
  }

  @Post(':id/assign-season')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  assignToSeason(@CurrentUser() user: any, @Param('id') id: string, @Body() assignToSeasonDto: AssignToSeasonDto) {
    return this.teamsService.assignToSeason(id, assignToSeasonDto, user?.id);
  }
}
