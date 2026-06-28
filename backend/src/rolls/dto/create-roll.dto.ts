import {
  IsString,
  IsOptional,
  IsDecimal,
  IsNumber,
  Min,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRollDto {
  @IsString()
  barcodeNumber: string;

  @IsString()
  fabricType: string;

  @IsString()
  color: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  widthCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weightGsm?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lengthM: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  netWeightKg: number;

  @IsOptional()
  @IsString()
  quality?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Production recipe fields
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
