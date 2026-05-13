import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const leads = await prisma.lead.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
  console.log('--- LEADS ---');
  leads.forEach(l => console.log(`Phone: ${l.phone}, Normalized: ${l.phoneNormalized}, Campaign: ${l.campaignName}`));
  
  const sales = await prisma.sale.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
  console.log('--- SALES ---');
  sales.forEach(s => console.log(`Phone: ${s.phone}, Normalized: ${s.phoneNormalized}, Campaign: ${s.campaignName}`));
}

check().catch(console.error).finally(() => prisma.$disconnect());
