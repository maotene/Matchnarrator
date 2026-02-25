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
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { AssignToTeamDto } from './dto/assign-to-team.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('players')
@UseGuards(JwtAuthGuard)
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  create(@CurrentUser() user: any, @Body() createPlayerDto: CreatePlayerDto) {
    return this.playersService.create(createPlayerDto, user?.id);
  }

  @Post('bulk-import')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  bulkImport(
    @Body() body: {
      seasonId: string;
      clearExistingForTeams?: boolean;
      teams: Array<{
        teamSeasonId?: string;
        teamName?: string;
        players: Array<{
          firstName?: string;
          lastName?: string;
          name?: string;
          jerseyNumber?: number;
          position?: string;
          nationality?: string;
          birthDate?: string;
          photo?: string;
        }>;
      }>;
    },
  ) {
    return this.playersService.bulkImport(body);
  }

  @Get()
  findAll() {
    return this.playersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.playersService.findOne(id);
  }

  @Get(':id/summary')
  getSummary(@Param('id') id: string, @Query('seasonId') seasonId?: string) {
    return this.playersService.getSummary(id, seasonId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() updatePlayerDto: UpdatePlayerDto) {
    return this.playersService.update(id, updatePlayerDto, user?.id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.playersService.remove(id, user?.id);
  }

  @Post(':id/assign-team')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  assignToTeam(@CurrentUser() user: any, @Param('id') id: string, @Body() assignToTeamDto: AssignToTeamDto) {
    return this.playersService.assignToTeam(id, assignToTeamDto, user?.id);
  }
}
