async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const sales = await prisma.sale.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
  console.log("LAST 5 SALES:");
  for (const s of sales) {
    console.log(`ID: ${s.id} | createdAt: ${s.createdAt} | amount: ${s.amount} | externalId: ${s.externalId}`);
  }
  await prisma.$disconnect();
}
main();
