import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PlayerPosition } from '@prisma/client';

export class UpdatePlayerDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  photo?: string;

  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  nationality?: string;

  @IsEnum(PlayerPosition)
  @IsOptional()
  position?: PlayerPosition;
}
