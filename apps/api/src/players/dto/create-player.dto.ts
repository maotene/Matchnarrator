import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PlayerPosition } from '@prisma/client';

export class CreatePlayerDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

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
