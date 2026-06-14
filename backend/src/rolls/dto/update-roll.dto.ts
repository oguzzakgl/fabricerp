import { IsString, IsOptional, IsNumber, Min, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRollDto {
  @IsOptional()
  @IsString()
  barcodeNumber?: string;

  @IsOptional()
  @IsString()
  fabricType?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  widthCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weightGsm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lengthM?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  netWeightKg?: number;

  @IsOptional()
  @IsString()
  quality?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  warpYarnId?: string;

  @IsOptional()
  @IsUUID()
  weftYarnId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  warpKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weftKg?: number;
}
