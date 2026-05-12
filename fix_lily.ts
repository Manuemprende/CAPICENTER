import { PrismaClient } from '@prisma/client';
import { processAttribution } from './src/lib/attribution.js';

const prisma = new PrismaClient();

async function fix() {
  const phone = '56934997488';
  console.log(`Re-procesando atribución para ${phone}...`);
  const leads = await prisma.lead.findMany({
    where: { phoneNormalized: phone }
  });
  console.log(`Encontrados ${leads.length} leads.`);
  leads.forEach(l => console.log(`Lead ${l.id}: Campaign=${l.campaignName}, ctwaClid=${l.ctwaClid}`));
  
  const sales = await prisma.sale.findMany({
    where: { phoneNormalized: phone }
  });
  console.log(`Encontradas ${sales.length} ventas.`);
  for (const s of sales) {
    const res = await processAttribution(s.id);
    console.log(`Venta ${s.id}: ${JSON.stringify(res)}`);
  }
}

fix().catch(console.error).finally(() => prisma.$disconnect());
