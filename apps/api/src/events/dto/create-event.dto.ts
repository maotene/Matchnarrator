import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { EventType, TeamSide, MatchPeriod } from '@prisma/client';

export class CreateEventDto {
  @IsString()
  @IsOptional()
  rosterPlayerId?: string;

  @IsEnum(TeamSide)
  @IsNotEmpty()
  teamSide: TeamSide;

  @IsEnum(EventType)
  @IsNotEmpty()
  eventType: EventType;

  @IsEnum(MatchPeriod)
  @IsNotEmpty()
  period: MatchPeriod;

  @IsInt()
  @Min(0)
  @IsNotEmpty()
  minute: number;

  @IsInt()
  @Min(0)
  @IsNotEmpty()
  second: number;

  @IsOptional()
  payload?: any;
}
