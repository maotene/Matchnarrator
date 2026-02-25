import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { PlayerPosition } from '@prisma/client';

export class UpdateRosterPlayerDto {
  @IsString()
  @IsOptional()
  customName?: string;

  @IsInt()
  @IsOptional()
  jerseyNumber?: number;

  @IsBoolean()
  @IsOptional()
  isStarter?: boolean;

  @IsEnum(PlayerPosition)
  @IsOptional()
  position?: PlayerPosition;

  @IsNumber()
  @IsOptional()
  layoutX?: number;

  @IsNumber()
  @IsOptional()
  layoutY?: number;
}
