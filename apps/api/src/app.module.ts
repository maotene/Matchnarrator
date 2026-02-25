import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompetitionsModule } from './competitions/competitions.module';
import { SeasonsModule } from './seasons/seasons.module';
import { TeamsModule } from './teams/teams.module';
import { PlayersModule } from './players/players.module';
import { MatchesModule } from './matches/matches.module';
import { RosterModule } from './roster/roster.module';
import { EventsModule } from './events/events.module';
import { ExportModule } from './export/export.module';
import { ImportModule } from './import/import.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CompetitionsModule,
    SeasonsModule,
    TeamsModule,
    PlayersModule,
    MatchesModule,
    RosterModule,
    EventsModule,
    ExportModule,
    ImportModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
