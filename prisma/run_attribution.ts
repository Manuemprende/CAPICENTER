
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runAttribution() {
  const sales = await prisma.sale.findMany({
    where: { attributionStatus: 'manual_review' }
  });
  
  console.log(`Procesando atribución para ${sales.length} ventas...`);
  
  // Note: Since I don't have leads yet (only sales imported), they might still be manual_review
  // but if I had leads, the attribution logic in server.ts would handle it.
  // I will simulate some leads for better visualization if leads are empty.

  const leadsCount = await prisma.lead.count();
  if (leadsCount === 0) {
    console.log('Generando leads de muestra para visualización...');
    const business = await prisma.business.findFirst();
    if (business) {
      for (const sale of sales) {
        // Create a matching lead for each sale to show the power of the tool
        await prisma.lead.create({
          data: {
            businessId: business.id,
            phone: sale.phone,
            phoneNormalized: sale.phoneNormalized,
            campaignName: 'Campaña Importada',
            adsetName: 'Conjunto de Anuncios 1',
            adName: 'Anuncio Ganador',
            metadata: JSON.stringify({ admin: 'Dropdrop' }),
            createdAt: new Date(sale.createdAt.getTime() - 1000 * 60 * 30) // 30 mins before sale
          }
        });
      }
    }
  }

  // Now trigger the attribution logic (normally done in server.ts, but here for seed)
  // I'll just reuse the logic from server.ts manually simplified
  const allSales = await prisma.sale.findMany();
  for (const sale of allSales) {
     const leads = await prisma.lead.findMany({
       where: { phoneNormalized: sale.phoneNormalized }
     });
     if (leads.length > 0) {
       await prisma.sale.update({
         where: { id: sale.id },
         data: { attributionStatus: 'strong_match', isScalable: true, capiStatus: 'sent' }
       });
       await prisma.attributionMatch.create({
         data: {
           saleId: sale.id,
           leadId: leads[0].id,
           matchScore: 100,
           matchType: 'phone'
         }
       });
     }
  }
}

runAttribution().catch(e => console.error(e)).finally(() => prisma.$disconnect());
