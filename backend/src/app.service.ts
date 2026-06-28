import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getStats(tenantId: string) {
    // 1. Cari Accounts Count
    const cariCount = await this.prisma.account.count({
      where: { tenantId },
    });

    // 2. Yarn Total KG
    const yarnTotalAggregate = await this.prisma.yarnStock.aggregate({
      where: { tenantId },
      _sum: {
        currentKg: true,
      },
    });
    const yarnTotalKg = Number(yarnTotalAggregate._sum.currentKg || 0);

    // 3. Pending Cheques / Finance amount
    const pendingTransactions = await this.prisma.financialTransaction.findMany(
      {
        where: {
          tenantId,
          status: 'pending',
        },
      },
    );
    const pendingChequesAmount = pendingTransactions.reduce(
      (sum, tx) => sum + Number(tx.amount),
      0,
    );
    const pendingChequesCount = pendingTransactions.length;

    // 4. Critical stocks (currentKg <= 100)
    const criticalStocks = await this.prisma.yarnStock.findMany({
      where: {
        tenantId,
        currentKg: {
          lte: 100,
        },
      },
      take: 4,
      orderBy: {
        currentKg: 'asc',
      },
      include: {
        supplier: true,
      },
    });

    // 5. Urgent payments (vadesi yaklaşan ödemeler)
    const urgentPayments = await this.prisma.financialTransaction.findMany({
      where: {
        tenantId,
        status: 'pending',
      },
      take: 5,
      orderBy: {
        dueDate: 'asc',
      },
      include: {
        account: true,
      },
    });

    // 6. Gelir & Gider Analizi (Last 6 months)
    const chartData = [];
    const now = new Date();
    const monthsTr = [
      'Oca',
      'Şub',
      'Mar',
      'Nis',
      'May',
      'Haz',
      'Tem',
      'Ağu',
      'Eyl',
      'Eki',
      'Kas',
      'Ara',
    ];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const startOfMonth = new Date(year, monthIndex, 1);
      const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

      // Income: Invoices issued in this month
      const invoices = await this.prisma.invoice.findMany({
        where: {
          tenantId,
          issueDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });
      const income = invoices.reduce(
        (sum, inv) => sum + Number(inv.totalAmount),
        0,
      );

      // Expense: Yarn stocks purchased in this month
      const yarnStocks = await this.prisma.yarnStock.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });
      const expense = yarnStocks.reduce(
        (sum, ys) => sum + Number(ys.initialKg) * Number(ys.unitPrice),
        0,
      );

      chartData.push({
        month: monthsTr[monthIndex],
        income,
        expense,
      });
    }

    return {
      cariCount,
      yarnTotalKg,
      pendingChequesAmount,
      pendingChequesCount,
      criticalStocks,
      urgentPayments,
      chartData,
    };
  }
}
