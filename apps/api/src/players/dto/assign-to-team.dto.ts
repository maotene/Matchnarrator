import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignToTeamDto {
  @IsString()
  @IsNotEmpty()
  teamSeasonId: string;

  @IsInt()
  @IsOptional()
  jerseyNumber?: number;
}
