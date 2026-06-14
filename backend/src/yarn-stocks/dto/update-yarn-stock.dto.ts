import { IsString, IsOptional, IsUUID, IsNumber, Min } from 'class-validator';

export class UpdateYarnStockDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  yarnType?: string;

  @IsOptional()
  @IsString()
  neNumber?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  colorCode?: string;

  @IsOptional()
  @IsString()
  lotNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}
