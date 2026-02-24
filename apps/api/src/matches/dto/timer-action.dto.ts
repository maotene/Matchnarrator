import { IsInt, IsOptional } from 'class-validator';

export class UpdateAddedTimeDto {
  @IsInt()
  @IsOptional()
  firstHalfAddedTime?: number;

  @IsInt()
  @IsOptional()
  secondHalfAddedTime?: number;
}
