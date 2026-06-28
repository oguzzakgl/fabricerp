import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsDateString,
} from 'class-validator';

export class CreateWaybillPriceDto {
  @IsString()
  fabricType: string;

  @IsString()
  color: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateWaybillDto {
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsUUID()
  customerId: string;

  @IsDateString()
  issueDate: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  rollIds: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWaybillPriceDto)
  prices?: CreateWaybillPriceDto[];
}
