import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

export class UpsertFabricCardDto {
  @IsString()
  fabricType: string;

  @IsNumber()
  @IsOptional()
  pricePerMeter?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsObject()
  @IsOptional()
  colorMapping?: Record<string, unknown>;
}
