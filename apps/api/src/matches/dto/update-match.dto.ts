import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { MatchStatus } from '@prisma/client';

export class UpdateMatchDto {
  @IsDateString()
  @IsOptional()
  matchDate?: string;

  @IsString()
  @IsOptional()
  venue?: string;

  @IsEnum(MatchStatus)
  @IsOptional()
  status?: MatchStatus;
}
