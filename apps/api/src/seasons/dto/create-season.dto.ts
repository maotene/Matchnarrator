import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSeasonDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  competitionId: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
