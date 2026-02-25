import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PlayerPosition } from '@prisma/client';

export class CreateRosterPlayerDto {
  @IsString()
  @IsNotEmpty()
  playerId: string;

  @IsString()
  @IsNotEmpty()
  teamId: string;

  @IsInt()
  @IsNotEmpty()
  jerseyNumber: number;

  @IsBoolean()
  @IsNotEmpty()
  isHomeTeam: boolean;

  @IsString()
  @IsOptional()
  customName?: string;

  @IsBoolean()
  @IsOptional()
  isStarter?: boolean;

  @IsEnum(PlayerPosition)
  @IsOptional()
  position?: PlayerPosition;
}
