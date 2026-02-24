import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMatchDto {
  @IsString()
  @IsNotEmpty()
  homeTeamId: string;

  @IsString()
  @IsNotEmpty()
  awayTeamId: string;

  @IsDateString()
  @IsNotEmpty()
  matchDate: string;

  @IsString()
  @IsOptional()
  venue?: string;

  @IsString()
  @IsOptional()
  fixtureMatchId?: string;
}
