import { IsBoolean, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { PlayerPosition } from '@prisma/client';

export class UpdateRosterPlayerDto {
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
