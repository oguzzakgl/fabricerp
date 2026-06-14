import { IsNotEmpty, IsString, IsOptional, IsUUID, IsNumber, Min } from 'class-validator';

export class CreateYarnStockDto {
  @IsNotEmpty()
  @IsUUID()
  supplierId: string;

  @IsNotEmpty()
  @IsString()
  yarnType: string;

  @IsOptional()
  @IsString()
  neNumber?: string;

  @IsNotEmpty()
  @IsString()
  color: string;

  @IsOptional()
  @IsString()
  colorCode?: string;

  @IsNotEmpty()
  @IsString()
  lotNumber: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  initialKg: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  unitPrice: number;
}
