
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function importSales() {
  console.log('Importando ventas reales desde Google Sheets...');
  const business = await prisma.business.findFirst();
  if (!business) return;

  // URL del segundo set de datos (Dropdrop/Chile2025 compartido)
  const url = 'https://docs.google.com/spreadsheets/d/1hoo9ev1sfYo8k_4Ngl2vtBSksCPyewhAnZS5T8YnaY8/export?format=csv&gid=841852057';
  
  try {
    const res = await axios.get(url);
    const lines = res.data.split('\r\n'); // Handle CRLF
    const headers = lines[0].split(',');
    
    let count = 0;
    for (let i = 1; i < lines.length; i++) {
       const row = lines[i].split(',');
       if (row.length < 4) continue;
       
       const phone = row[2];
       const amount = parseFloat(row[3]);
       const name = row[1];
       const dateStr = row[0];
       
       if (isNaN(amount) || !phone) continue;

       const normalizePhone = (p: string) => p.replace(/\D/g, "");
       const phoneNormalized = normalizePhone(phone);

       await prisma.sale.create({
         data: {
           businessId: business.id,
           phone: phone,
           phoneNormalized,
           amount: amount,
           currency: 'CLP',
           paymentStatus: 'paid',
           metadata: JSON.stringify({ name }),
           createdAt: new Date(dateStr)
         }
       });
       count++;
    }
    console.log(`${count} ventas reales importadas con éxito.`);
  } catch (e: any) {
    console.error('Error al importar ventas:', e.message);
  }
}

async function main() {
  await importSales();
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
