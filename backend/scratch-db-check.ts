import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- TESTING ORDER CREATION LOGIC ---');
  
  // Find a tenant
  const user = await prisma.user.findFirst({
    where: { tenantId: { not: null } }
  });
  if (!user || !user.tenantId) {
    console.log('No user with tenantId found.');
    return;
  }
  const tenantId = user.tenantId;
  console.log(`Using Tenant ID: ${tenantId}`);

  // Find a customer
  const customer = await prisma.account.findFirst({
    where: { tenantId, type: { in: ['CUSTOMER', 'BOTH'] } }
  });
  if (!customer) {
    console.log('No CUSTOMER account found for this tenant. Creating one...');
    const newCustomer = await prisma.account.create({
      data: {
        code: 'M-00001',
        name: 'Test Customer LLC',
        type: 'CUSTOMER',
        currency: 'TRY',
        tenantId,
      }
    });
    console.log(`Created Customer: ${newCustomer.id}`);
  } else {
    console.log(`Using Customer: ${customer.name} (${customer.id})`);
  }

  // Find an available roll
  const roll = await prisma.roll.findFirst({
    where: { tenantId, status: 'available' }
  });

  let selectedRollId = '';
  if (!roll) {
    console.log('No available roll found. Creating one...');
    const barcode = `ROLL-${Date.now()}`;
    const newRoll = await prisma.roll.create({
      data: {
        barcodeNumber: barcode,
        fabricType: 'Süprem',
        color: 'Siyah',
        lengthM: 50.00,
        netWeightKg: 15.00,
        costPrice: 80.00,
        status: 'available',
        tenantId,
      }
    });
    selectedRollId = newRoll.id;
    console.log(`Created Roll: ${newRoll.id} (Barcode: ${barcode})`);
  } else {
    selectedRollId = roll.id;
    console.log(`Using Roll: ${roll.barcodeNumber} (${roll.id})`);
  }

  // Try creating an order with this customer and roll
  const targetCustomer = customer || await prisma.account.findFirst({ where: { tenantId } });
  if (!targetCustomer) {
    console.log('Target customer still null.');
    return;
  }

  console.log('Simulating order number generation...');
  const year = new Date().getFullYear();
  const lastOrder = await prisma.order.findFirst({
    where: {
      tenantId,
      orderNumber: { startsWith: `SIP-${year}-` },
    },
    orderBy: { createdAt: 'desc' },
    select: { orderNumber: true },
  });
  
  let orderNumber = `SIP-${year}-00001`;
  if (lastOrder) {
    const parts = lastOrder.orderNumber.split('-');
    const lastNumStr = parts[parts.length - 1];
    const lastNum = parseInt(lastNumStr, 10);
    orderNumber = `SIP-${year}-${String(lastNum + 1).padStart(5, '0')}`;
  }
  console.log(`Generated Order Number: ${orderNumber}`);

  try {
    console.log('Starting transaction for order creation...');
    const result = await prisma.$transaction(async (tx) => {
      let subtotal = 0;

      // Lock and validate the roll
      const lockedRoll = await tx.roll.findFirst({
        where: { id: selectedRollId, tenantId },
      });
      if (!lockedRoll) throw new Error('Roll not found inside transaction.');
      if (lockedRoll.status !== 'available') throw new Error(`Roll not available. Status: ${lockedRoll.status}`);

      subtotal += Number(lockedRoll.lengthM) * 150; // unit price 150

      const taxRate = 20;
      const totalAmount = subtotal * (1 + taxRate / 100);

      console.log(`Calculated Subtotal: ${subtotal}, Total Amount: ${totalAmount}`);

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId: targetCustomer.id,
          notes: 'Test Order via scratch script',
          totalAmount,
          currency: targetCustomer.currency || 'TRY',
          status: 'confirmed',
          tenantId,
          orderItems: {
            create: [
              {
                rollId: selectedRollId,
                unitPrice: 150,
              }
            ]
          }
        },
        include: {
          customer: true,
          orderItems: {
            include: { roll: true }
          }
        }
      });

      // Mark roll as reserved
      await tx.roll.update({
        where: { id: selectedRollId },
        data: { status: 'reserved' }
      });

      return createdOrder;
    });

    console.log(`Successfully created order! Order Number: ${result.orderNumber}, ID: ${result.id}`);
    
    // Cleanup created test order to leave DB clean
    console.log('Cleaning up test data...');
    await prisma.order.delete({
      where: { id: result.id }
    });
    await prisma.roll.update({
      where: { id: selectedRollId },
      data: { status: 'available' }
    });
    console.log('Cleanup completed successfully.');

  } catch (error) {
    console.error('Failed to create order. Error:', error);
  }
}

main()
  .catch((e) => console.error('Execution failed:', e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
