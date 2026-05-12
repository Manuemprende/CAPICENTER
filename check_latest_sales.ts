import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  const sales = await prisma.sale.findMany({
    orderBy: { createdAt: "desc" },
    take: 5
  });
  console.log("LAST 5 SALES:");
  for (const s of sales) {
    console.log(`ID: ${s.id} | createdAt: ${s.createdAt} | amount: ${s.amount} | externalId: ${s.externalId}`);
  }
}
check().finally(() => prisma.$disconnect());
