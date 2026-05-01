
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import crypto from 'crypto';

const prisma = new PrismaClient();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "fallback_key_32_chars_long_12345";

function encrypt(text: string) {
  if (!text) return "";
  const IV_LENGTH = 16;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text.trim());
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

const normalizePhone = (p: string) => p ? p.replace(/\D/g, "") : "";

// Simple CSV parser to handle quotes and commas
function parseCSVRow(line: string) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else current += char;
  }
  result.push(current);
  return result;
}

async function importEverything() {
  console.log('🚀 Iniciando MEGA-IMPORTACIÓN...');

  await prisma.auditLog.deleteMany();
  await prisma.capiEvent.deleteMany();
  await prisma.attributionMatch.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.metaConfig.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.business.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: { email: 'admin@crmautomations.site', name: 'Super Admin' }
  });
  const business = await prisma.business.create({
    data: { id: 'default-biz', name: 'CRM Global Automations', userId: user.id }
  });
  await prisma.apiKey.create({
    data: { key: 'test_key_123456', businessId: business.id }
  });

  const sheet1 = '1axSytZtZgoSiSZQ3H6G8Jx8mMG864MN1HAsy2HorqXc';
  const sheet2 = '1hoo9ev1sfYo8k_4Ngl2vtBSksCPyewhAnZS5T8YnaY8';

  // 1. ADMINS
  console.log('--- Importando Administradores ---');
  const adminsRes = await axios.get(`https://docs.google.com/spreadsheets/d/${sheet2}/export?format=csv&gid=0`);
  const adminLines = adminsRes.data.split(/\r?\n/);
  for (let i = 1; i < adminLines.length; i++) {
    const row = parseCSVRow(adminLines[i]);
    if (row.length < 5) continue;
    const [numero, inboxId, adminName, pixelId, accessToken, chatwootUrl] = row;
    await prisma.metaConfig.create({
      data: {
        businessId: business.id,
        pixelId: pixelId?.trim(),
        accessToken: encrypt(accessToken),
        adminName: adminName?.trim(),
        phoneNumber: numero?.trim(),
        inboxId: inboxId?.trim(),
        chatwootUrl: chatwootUrl?.trim(),
      }
    });
  }

  // 2. VENTAS
  const salesSources = [
    { id: sheet1, gid: '934969229', name: 'Sheet 1' },
    { id: sheet2, gid: '841852057', name: 'Sheet 2' }
  ];
  for (const src of salesSources) {
    console.log(`--- Importando Ventas ${src.name} ---`);
    const res = await axios.get(`https://docs.google.com/spreadsheets/d/${src.id}/export?format=csv&gid=${src.gid}`);
    const lines = res.data.split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const row = parseCSVRow(lines[i]);
      const [fecha, nombre, telefono, montoStr, etapa, idConv, pais, convertido] = row;
      const monto = parseFloat(montoStr);
      if (isNaN(monto) || !telefono) continue;
      const dateVal = new Date(fecha);
      const createdAt = isNaN(dateVal.getTime()) ? new Date() : dateVal;
      await prisma.sale.create({
        data: {
          businessId: business.id,
          createdAt,
          customerName: nombre?.trim(),
          phone: telefono?.trim(),
          phoneNormalized: normalizePhone(telefono),
          amount: monto,
          stage: etapa?.trim(),
          conversationId: idConv?.trim(),
          country: pais?.trim(),
          isConverted: convertido?.trim()
        }
      });
    }
  }

  // 3. LEADS (CAPI)
  const capiSources = [
    { id: sheet1, gid: '1731322365', name: 'Leads Sheet 1' },
    { id: sheet2, gid: '1264850674', name: 'Leads Sheet 2' }
  ];
  for (const src of capiSources) {
    console.log(`--- Importando Leads ${src.name} ---`);
    const res = await axios.get(`https://docs.google.com/spreadsheets/d/${src.id}/export?format=csv&gid=${src.gid}`);
    const lines = res.data.split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = parseCSVRow(lines[i]);
        // Fecha,pais,Nombre,Teléfono,ad_id,ctwa_clid,ad_headline,ad_url,Convertido,meta_event_id,meta_status,meta_response,meta_error,intentos_reintento,requiere_revision_manual,fecha_envio_meta
        const [fecha, pais, nombre, telefono, adId, clid, headline, adUrl, converted, metaEvId, metaStat, metaResp, metaErr, intentos, manual, fechaMeta] = row;
        const norm = normalizePhone(telefono);
        if (!norm) continue;
        const dateVal = new Date(fecha);
        const createdAt = isNaN(dateVal.getTime()) ? new Date() : dateVal;
        
        const fechaMetaVal = fechaMeta ? new Date(fechaMeta) : null;

        await prisma.lead.create({
          data: {
            businessId: business.id,
            createdAt,
            customerName: nombre?.trim(),
            country: pais?.trim(),
            phone: telefono?.trim(),
            phoneNormalized: norm,
            ctwaClid: clid?.trim(),
            adId: adId?.trim(),
            adName: headline?.trim(),
            adUrl: adUrl?.trim(),
            isConverted: converted?.trim(),
            metaEventId: metaEvId?.trim(),
            metaStatus: metaStat?.trim(),
            metaResponse: metaResp?.trim(),
            metaError: metaErr?.trim(),
            intentosReintento: parseInt(intentos) || 0,
            requiereRevisionManual: manual?.toLowerCase() === 'true' || manual === '1',
            fechaEnvioMeta: fechaMetaVal && !isNaN(fechaMetaVal.getTime()) ? fechaMetaVal : null
          }
        });
    }
  }

  // 4. ATRIBUCIÓN
  const allSales = await prisma.sale.findMany();
  const allLeads = await prisma.lead.findMany();
  console.log(`Atribuyendo: ${allSales.length} ventas VS ${allLeads.length} leads...`);
  
  let matches = 0;
  for (const s of allSales) {
    const lead = await prisma.lead.findFirst({
        where: {
            OR: [
                { phoneNormalized: s.phoneNormalized },
                { phoneNormalized: { endsWith: s.phoneNormalized.slice(-8) } }
            ]
        }
    });
    if (lead) {
        await prisma.sale.update({
            where: { id: s.id },
            data: { 
                attributionStatus: 'strong_match', 
                isScalable: true,
                ctwaClid: lead.ctwaClid || s.ctwaClid,
                adId: lead.adId,
                adName: lead.adName,
                adUrl: lead.adUrl,
                metaEventId: lead.metaEventId,
                metaStatus: lead.metaStatus,
                metaResponse: lead.metaResponse,
                metaError: lead.metaError,
                intentosReintento: lead.intentosReintento,
                requiereRevisionManual: lead.requiereRevisionManual,
                fechaEnvioMeta: lead.fechaEnvioMeta
            }
        });
        matches++;
    }
  }
  console.log(`✅ Atribución lista: ${matches} coincidencias.`);
}

importEverything().catch(e => console.error(e)).finally(() => prisma.$disconnect());
