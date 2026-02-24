import { IsOptional, IsString } from 'class-validator';

export class UpdateCompetitionDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  logo?: string;
}
