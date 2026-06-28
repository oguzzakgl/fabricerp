import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { AccountsModule } from './accounts/accounts.module';
import { YarnStocksModule } from './yarn-stocks/yarn-stocks.module';
import { RollsModule } from './rolls/rolls.module';
import { OrdersModule } from './orders/orders.module';
import { InvoicesModule } from './invoices/invoices.module';
import { FinanceModule } from './finance/finance.module';
import { SettingsModule } from './settings/settings.module';
import { AuthModule } from './auth/auth.module';
import { FabricCardsModule } from './fabric-cards/fabric-cards.module';
import { WaybillsModule } from './waybills/waybills.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AccountsModule,
    YarnStocksModule,
    RollsModule,
    OrdersModule,
    InvoicesModule,
    FinanceModule,
    SettingsModule,
    FabricCardsModule,
    WaybillsModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
