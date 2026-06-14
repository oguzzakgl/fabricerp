import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  IsDateString,
  IsEnum,
} from 'class-validator';

export enum TransactionType {
  CHECK = 'CHECK',
  BILL_OF_EXCHANGE = 'BILL_OF_EXCHANGE',
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export enum TransactionDirection {
  RECEIVABLE = 'RECEIVABLE',
  PAYABLE = 'PAYABLE',
}

export class CreateFinancialTransactionDto {
  @IsUUID()
  accountId: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsEnum(TransactionDirection)
  direction: TransactionDirection;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
