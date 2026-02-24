import { IsNotEmpty, IsString } from 'class-validator';

export class AssignToSeasonDto {
  @IsString()
  @IsNotEmpty()
  seasonId: string;
}
