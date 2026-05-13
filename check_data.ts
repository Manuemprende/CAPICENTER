import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const phone = '56934997488';
  const leads = await prisma.lead.findMany({ where: { phoneNormalized: phone } });
  console.log('--- LEADS ---');
  leads.forEach(l => console.log(`Phone: ${l.phone}, Normalized: ${l.phoneNormalized}, Campaign: ${l.campaignName}, AdID: ${l.adId}`));
  
  const sales = await prisma.sale.findMany({ where: { phoneNormalized: phone } });
  console.log('--- SALES ---');
  sales.forEach(s => console.log(`Phone: ${s.phone}, Normalized: ${s.phoneNormalized}, Campaign: ${s.campaignName}`));
}

check().catch(console.error).finally(() => prisma.$disconnect());
