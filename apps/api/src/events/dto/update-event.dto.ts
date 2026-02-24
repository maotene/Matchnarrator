import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { EventType, TeamSide, MatchPeriod } from '@prisma/client';

export class UpdateEventDto {
  @IsString()
  @IsOptional()
  rosterPlayerId?: string;

  @IsEnum(TeamSide)
  @IsOptional()
  teamSide?: TeamSide;

  @IsEnum(EventType)
  @IsOptional()
  eventType?: EventType;

  @IsEnum(MatchPeriod)
  @IsOptional()
  period?: MatchPeriod;

  @IsInt()
  @Min(0)
  @IsOptional()
  minute?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  second?: number;

  @IsOptional()
  payload?: any;
}
