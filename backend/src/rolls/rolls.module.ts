import { Module } from '@nestjs/common';
import { RollsService } from './rolls.service';
import { RollsController } from './rolls.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RollsController],
  providers: [RollsService],
  exports: [RollsService],
})
export class RollsModule {}
