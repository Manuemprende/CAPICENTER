import { PrismaClient } from '@prisma/client';
import { processAttribution } from './src/lib/attribution.js';

const prisma = new PrismaClient();

async function fixAll() {
  console.log('Iniciando re-atribución masiva de ventas orgánicas...');
  
  const organicSales = await prisma.sale.findMany({
    where: { 
      OR: [
        { campaignName: null },
        { campaignName: '' }
      ]
    }
  });

  console.log(`Encontradas ${organicSales.length} ventas sin campaña.`);
  let fixedCount = 0;

  for (const s of organicSales) {
    const res = await processAttribution(s.id);
    if (res.success) {
      fixedCount++;
      const updated = await prisma.sale.findUnique({ where: { id: s.id } });
      console.log(`✅ Venta ${s.id} (${s.customerName}) -> ${updated?.campaignName} [${res.leadId}]`);
    }
  }

  console.log(`--- PROCESO FINALIZADO ---`);
  console.log(`Total ventas corregidas: ${fixedCount}`);
}

fixAll().catch(console.error).finally(() => prisma.$disconnect());
