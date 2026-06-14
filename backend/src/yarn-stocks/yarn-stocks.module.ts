import { Module } from '@nestjs/common';
import { YarnStocksService } from './yarn-stocks.service';
import { YarnStocksController } from './yarn-stocks.controller';

@Module({
  controllers: [YarnStocksController],
  providers: [YarnStocksService],
  exports: [YarnStocksService],
})
export class YarnStocksModule {}
