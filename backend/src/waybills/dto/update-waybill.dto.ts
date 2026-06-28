import { PartialType } from '@nestjs/mapped-types';
import { CreateWaybillDto } from './create-waybill.dto';

export class UpdateWaybillDto extends PartialType(CreateWaybillDto) {}
