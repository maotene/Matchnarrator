import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('matches/:matchId/export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get()
  exportMatch(@Param('matchId') matchId: string) {
    return this.exportService.exportMatch(matchId);
  }
}
