import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsIn,
  IsEmail,
} from 'class-validator';

export class CreateAccountDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['CUSTOMER', 'SUPPLIER', 'BOTH'])
  type: string;

  @IsOptional()
  @IsString()
  taxOffice?: string;

  @IsOptional()
  @IsString()
  taxNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
