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

    // 7. Toplam Gelir & Gider (tüm zamanlar)
    const allInvoices = await this.prisma.invoice.aggregate({
      where: { tenantId },
      _sum: { totalAmount: true },
    });
    const totalIncome = Number(allInvoices._sum.totalAmount || 0);

    const allYarnPurchases = await this.prisma.yarnStock.findMany({
      where: { tenantId },
      select: { initialKg: true, unitPrice: true },
    });
    const totalExpense = allYarnPurchases.reduce(
      (sum, ys) => sum + Number(ys.initialKg) * Number(ys.unitPrice),
      0,
    );

    // 8. Toplam Alacak (müşteri net bakiyeleri toplamı - pozitif)
    const customerAccounts = await this.prisma.account.findMany({
      where: { tenantId, type: { in: ['CUSTOMER', 'BOTH'] } },
      include: {
        orders: { select: { totalAmount: true, status: true } },
        financialTransactions: {
          where: { status: { notIn: ['cancelled', 'bounced'] } },
          select: {
            amount: true,
            direction: true,
            currency: true,
            convertedAmount: true,
            targetCurrency: true,
          },
        },
      },
    });

    let totalReceivable = 0;
    for (const acc of customerAccounts) {
      const orderTotal = acc.orders
        .filter(
          (o: { status: string; totalAmount: unknown }) =>
            o.status !== 'cancelled' && o.status !== 'draft',
        )
        .reduce(
          (s: number, o: { status: string; totalAmount: unknown }) =>
            s + Number(o.totalAmount || 0),
          0,
        );
      const received = acc.financialTransactions
        .filter(
          (tx: { direction: string; amount: unknown }) =>
            tx.direction === 'RECEIVABLE',
        )
        .reduce(
          (s: number, tx: { direction: string; amount: unknown }) =>
            s + Number(tx.amount || 0),
          0,
        );
      const net = orderTotal - received;
      if (net > 0) totalReceivable += net;
    }

    // 9. Toplam Verecek (tedarikçi net borçları toplamı - pozitif)
    const supplierAccounts = await this.prisma.account.findMany({
      where: { tenantId, type: { in: ['SUPPLIER', 'BOTH'] } },
      include: {
        yarnStocks: { select: { initialKg: true, unitPrice: true } },
        financialTransactions: {
          where: { status: { notIn: ['cancelled', 'bounced'] } },
          select: { amount: true, direction: true },
        },
      },
    });

    let totalPayable = 0;
    for (const acc of supplierAccounts) {
      const purchaseTotal = (acc.yarnStocks || []).reduce(
        (s: number, ys: { initialKg: unknown; unitPrice: unknown }) =>
          s + Number(ys.initialKg) * Number(ys.unitPrice),
        0,
      );
      const paid = acc.financialTransactions
        .filter(
          (tx: { direction: string; amount: unknown }) =>
            tx.direction === 'PAYABLE',
        )
        .reduce(
          (s: number, tx: { direction: string; amount: unknown }) =>
            s + Number(tx.amount || 0),
          0,
        );
      const net = purchaseTotal - paid;
      if (net > 0) totalPayable += net;
    }

    return {
      cariCount,
      yarnTotalKg,
      pendingChequesAmount,
      pendingChequesCount,
      criticalStocks,
      urgentPayments,
      chartData,
      totalIncome,
      totalExpense,
      totalReceivable,
      totalPayable,
    };
  }
}
