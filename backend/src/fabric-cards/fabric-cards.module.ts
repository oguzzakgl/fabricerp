import { Module } from '@nestjs/common';
import { FabricCardsController } from './fabric-cards.controller';
import { FabricCardsService } from './fabric-cards.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FabricCardsController],
  providers: [FabricCardsService],
  exports: [FabricCardsService],
})
export class FabricCardsModule {}
