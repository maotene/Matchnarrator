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
import { UserRole } from '@prisma/client';

@Controller('seasons')
@UseGuards(JwtAuthGuard)
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  create(@Body() createSeasonDto: CreateSeasonDto) {
    return this.seasonsService.create(createSeasonDto);
  }

  @Get()
  findAll(@Query('competitionId') competitionId?: string) {
    return this.seasonsService.findAll(competitionId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.seasonsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  update(@Param('id') id: string, @Body() updateSeasonDto: UpdateSeasonDto) {
    return this.seasonsService.update(id, updateSeasonDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  remove(@Param('id') id: string) {
    return this.seasonsService.remove(id);
  }
}
