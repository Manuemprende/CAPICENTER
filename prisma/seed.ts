
import { PrismaClient } from '@prisma/client';
import crypto from "crypto";

const prisma = new PrismaClient();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "fallback_key_32_chars_long_12345";

function encrypt(text: string) {
  const IV_LENGTH = 16;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'admin@crmautomations.site' },
    update: {},
    create: {
      email: 'admin@crmautomations.site',
      name: 'Super Admin'
    }
  });

  const business = await prisma.business.upsert({
    where: { id: 'default-biz' },
    update: {},
    create: { 
      id: 'default-biz', 
      name: 'CRM Automations',
      userId: user.id
    }
  });

  const admins = [
    { num: '56936447752', admin: 'Chile2025', pixel: '2227549151386663', token: 'EAAj7cjZCrNZCQBRfTMCDKg4sFOhncbPg048LiQZB5DTeDTnrkvLjs2F1Bhnb3QO4SNVHSi7F5sG9IG1TZA3l3ny0rllQupt3pqh1k38FeXVgZCPcOXl7OmESaws0KSCb4lvb2Q8VT94ghBPfIGfTytuaLyuKvsCxZBni43yU9qRDZBn0shorjL8vj9m0CBd9AZDZD' },
    { num: '56927449107', admin: 'Chile2025', pixel: '975188898557359', token: 'EAAj7cjZCrNZCQBRfTMCDKg4sFOhncbPg048LiQZB5DTeDTnrkvLjs2F1Bhnb3QO4SNVHSi7F5sG9IG1TZA3l3ny0rllQupt3pqh1k38FeXVgZCPcOXl7OmESaws0KSCb4lvb2Q8VT94ghBPfIGfTytuaLyuKvsCxZBni43yU9qRDZBn0shorjL8vj9m0CBd9AZDZD' },
    { num: '56933061233', admin: 'Administrador DropDrop', pixel: '3456698857820419', token: 'EAAXS48YkgU8BRASB7YXKn5stIvt24Ch4OUL2JabZAnmNToGkZCLy7PGRmBd2irgpnud2Nsn2ZBIh37P2E2mMLaAIAadXkOOonihByh0XucphiuI00QP4lctrFNdq3IphvZCcHxhudZBoxkgLSGFkAMU1V3OtxCS8ZBJS6gwcviGAMa734ZBw8dbtTX1tdIVcgZDZD' },
    { num: '56949639906', admin: 'Chile2025', pixel: '975188898557359', token: 'EAAj7cjZCrNZCQBRfTMCDKg4sFOhncbPg048LiQZB5DTeDTnrkvLjs2F1Bhnb3QO4SNVHSi7F5sG9IG1TZA3l3ny0rllQupt3pqh1k38FeXVgZCPcOXl7OmESaws0KSCb4lvb2Q8VT94ghBPfIGfTytuaLyuKvsCxZBni43yU9qRDZBn0shorjL8vj9m0CBd9AZDZD' },
    { num: '56922138913', admin: 'Chile2025', pixel: '975188898557359', token: 'EAAj7cjZCrNZCQBRfTMCDKg4sFOhncbPg048LiQZB5DTeDTnrkvLjs2F1Bhnb3QO4SNVHSi7F5sG9IG1TZA3l3ny0rllQupt3pqh1k38FeXVgZCPcOXl7OmESaws0KSCb4lvb2Q8VT94ghBPfIGfTytuaLyuKvsCxZBni43yU9qRDZBn0shorjL8vj9m0CBd9AZDZD' },
    { num: '56928669665', admin: 'Dropdrop', pixel: '909651732038945', token: 'EAAooXrAjp9QBRQOKnBEf4Oc4y7XT32UtmdwtM7WVcZCd9F41fxUfiNS4iQAT8Eb5Web3GeOVpyxaMVv8ueyMZBOARWVELloPPBYnZBdoyIgRwRpjKbiNyL2sBzZBJJbsbJiyFuytIyrKDKKhiX9gXj4jQv9KZC5dfnd1icc8R3ZBbs4pS7m9ufsHCohVa7jAZDZD' },
  ];

  for (const a of admins) {
    const existing = await prisma.metaConfig.findFirst({
      where: { phoneNumber: a.num, pixelId: a.pixel }
    });

    if (!existing) {
      await prisma.metaConfig.create({
        data: {
          businessId: business.id,
          pixelId: a.pixel,
          accessToken: encrypt(a.token),
          adminName: a.admin,
          phoneNumber: a.num,
          active: true
        }
      });
    }
  }

  // Ensure an API Key exists for testing
  const existingKey = await prisma.apiKey.findUnique({ where: { key: 'test_key_123456' } });
  if (!existingKey) {
    await prisma.apiKey.create({
      data: {
        key: 'test_key_123456',
        businessId: business.id
      }
    });
  }

  console.log('Seed exitoso: Administradores y API Key cargados.');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
