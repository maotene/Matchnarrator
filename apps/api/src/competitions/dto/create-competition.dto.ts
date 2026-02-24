import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCompetitionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  logo?: string;
}
