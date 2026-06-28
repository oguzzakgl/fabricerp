import { Module } from '@nestjs/common';
import { WaybillsService } from './waybills.service';
import { WaybillsController } from './waybills.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WaybillsController],
  providers: [WaybillsService],
  exports: [WaybillsService],
})
export class WaybillsModule {}
