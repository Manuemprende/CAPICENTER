import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { processAttribution, enrichLeadAdData } from './attribution.ts';

const prisma = new PrismaClient();

function normalizePhone(p: string) {
  return p ? p.replace(/\D/g, "") : "";
}

function parseCSVRow(line: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseAmount(value: any) {
  let normalized = String(value ?? "").trim().replace(/[^\d,.-]/g, "");
  if (!normalized) return NaN;
  const negative = normalized.startsWith("-");
  normalized = normalized.replace(/-/g, "");
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");
  let parsed: number;
  if (hasComma && hasDot) {
    const decimalSeparator = normalized.lastIndexOf(",") > normalized.lastIndexOf(".") ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    parsed = Number(normalized.replace(new RegExp(`\\${thousandsSeparator}`, "g"), "").replace(decimalSeparator, "."));
  } else if (hasComma) {
    const parts = normalized.split(",");
    parsed = parts.length > 1 && parts[parts.length - 1].length === 3
      ? Number(parts.join(""))
      : Number(normalized.replace(",", "."));
  } else if (hasDot) {
    const parts = normalized.split(".");
    parsed = parts.length > 1 && parts[parts.length - 1].length === 3
      ? Number(parts.join(""))
      : Number(normalized);
  } else {
    parsed = Number(normalized);
  }
  return negative ? -parsed : parsed;
}

function parseDate(value: any) {
  const raw = String(value ?? "").trim();
  if (!raw) return new Date();
  const matchYYYYTime = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (matchYYYYTime) {
    const [, y, m, d, hh, mm, ss] = matchYYYYTime;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss || 0));
  }
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const matchDDMM = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (matchDDMM) {
    const [, day, month, year] = matchDDMM;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function upsertSheetLead(businessId: string, source: { gid: string; name: string }, rowNumber: number, row: string[]) {
  try {
    const [dateStr, country, name, phone, adId, ctwaClid, adHeadline, adUrl, converted] = row;
    const phoneNormalized = normalizePhone(phone);
    if (!phoneNormalized) return null;
    const createdAt = parseDate(dateStr);
    
    const data = {
      phone: phone?.trim() || phoneNormalized,
      phoneNormalized,
      customerName: name?.trim() || null,
      country: country?.trim() || null,
      adId: adId?.trim() || null,
      ctwaClid: ctwaClid?.trim() || null,
      adHeadline: adHeadline?.trim() || null,
      adUrl: adUrl?.trim() || null,
      isConverted: converted?.trim() || null,
      createdAt,
      metadata: JSON.stringify({ source: source.name, row: rowNumber }),
    };

    // 1. Buscar por ctwaClid (exacto)
    let existing = null;
    if (data.ctwaClid) {
      existing = await prisma.lead.findFirst({
        where: { businessId, ctwaClid: data.ctwaClid }
      });
    }

    // 2. Si no hay, buscar por teléfono en ventana de 24h (para unir lead de Chatwoot con lead de Meta Sheet)
    if (!existing) {
      existing = await prisma.lead.findFirst({
        where: {
          businessId,
          phoneNormalized,
          createdAt: {
            gte: new Date(createdAt.getTime() - 24 * 60 * 60 * 1000),
            lte: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (existing) {
      // Si el existente es "orgánico" (no tiene adId) y el nuevo tiene adId, actualizamos
      const updated = await prisma.lead.update({ 
        where: { id: existing.id }, 
        data: {
          ...data,
          // Preservar datos si el nuevo viene vacío pero el viejo tenía algo
          customerName: data.customerName || existing.customerName,
          adId: data.adId || existing.adId,
          ctwaClid: data.ctwaClid || existing.ctwaClid,
        } 
      });
      
      // CRITICAL: Re-evaluate any sales that belong to this phone number
      // Because if a Sale arrived BEFORE this Lead sync, it was left as "Organic"
      if (updated.ctwaClid || updated.adId) {
        const pendingSales = await prisma.sale.findMany({
          where: { businessId, phoneNormalized }
        });
        for (const s of pendingSales) {
          // Re-process attribution to inject the new adId/campaignName into the sale
          await processAttribution(s.id).catch(() => {});
        }
      }
      
      return updated.id;
    }

    const metaEventId = data.ctwaClid ? `sheet-lead-${data.ctwaClid}` : `sheet-lead-${phoneNormalized}-${createdAt.getTime()}`;
    const created = await prisma.lead.create({ data: { businessId, metaEventId, ...data } });
    return created.id;
  } catch (err: any) {
    console.error(`[SYNC LEAD ERROR] Row ${rowNumber}:`, err.message);
    return null;
  }
}

async function upsertSheetSale(businessId: string, source: { gid: string; name: string }, rowNumber: number, row: string[]) {
  try {
    const [dateStr, name, phone, amountRaw, stage, conversationId, country, converted] = row;
    const amount = parseAmount(amountRaw);
    const phoneNormalized = normalizePhone(phone);
    if (!Number.isFinite(amount) || amount <= 0 || !phoneNormalized) return null;
    const createdAt = parseDate(dateStr);
    const chatwootExternalId = conversationId?.trim() ? `chatwoot-${conversationId.trim()}` : null;
    const sheetExternalId = `sheet-${source.gid}-${rowNumber}-${phoneNormalized}-${amount}`;
    const data = {
      amount,
      phone: phone?.trim() || phoneNormalized,
      phoneNormalized,
      customerName: name?.trim() || null,
      stage: stage?.trim() || null,
      conversationId: conversationId?.trim() || null,
      country: country?.trim() || null,
      isConverted: converted?.trim() || null,
      paymentStatus: 'paid',
      createdAt,
      metadata: JSON.stringify({ source: source.name, row: rowNumber, sheetExternalId }),
    };
    let existing = null;
    if (chatwootExternalId) {
      existing = await prisma.sale.findFirst({ where: { businessId, externalId: chatwootExternalId } });
    }
    if (!existing) {
      existing = await prisma.sale.findFirst({
        where: {
          businessId,
          phoneNormalized,
          createdAt: {
            gte: new Date(createdAt.getTime() - 24 * 60 * 60 * 1000),
            lte: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (existing) {
      const meta = JSON.parse(existing.metadata || '{}');
      if (meta.source === source.name && meta.row === rowNumber) return null; 
      const updated = await prisma.sale.update({ where: { id: existing.id }, data });
      return updated.id;
    }
    const created = await prisma.sale.create({
      data: { businessId, externalId: sheetExternalId, currency: 'CLP', ...data }
    });
    return created.id;
  } catch (err: any) {
    console.error(`[SYNC SALE ERROR] Row ${rowNumber}:`, err.message);
    return null;
  }
}

export async function syncGoogleSheets() {
  console.log('[SYNC] Iniciando sincronizacion total...');
  const business = await prisma.business.findFirst();
  if (!business) return { success: false, message: 'No business found' };

  const leadSources = [
    { id: '1hoo9ev1sfYo8k_4Ngl2vtBSksCPyewhAnZS5T8YnaY8', gid: '1264850674', name: 'Meta CAPI Leads' },
  ];
  const saleSources = [
    { id: '1axSytZtZgoSiSZQ3H6G8Jx8mMG864MN1HAsy2HorqXc', gid: '934969229', name: 'Sales Sheet 1' },
    { id: '1hoo9ev1sfYo8k_4Ngl2vtBSksCPyewhAnZS5T8YnaY8', gid: '841852057', name: 'Sales Sheet 2' },
  ];

  const processedSaleIds: string[] = [];
  const processedLeadIds: string[] = [];

  try {
    for (const source of leadSources) {
      const url = `https://docs.google.com/spreadsheets/d/${source.id}/export?format=csv&gid=${source.gid}`;
      const res = await axios.get(url, { timeout: 15000 });
      const lines = String(res.data).split(/\r?\n/);
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVRow(lines[i]);
        if (row.length < 4) continue;
        const id = await upsertSheetLead(business.id, source, i, row);
        if (id) {
          processedLeadIds.push(id);
          // Enrich if it has adId but no name yet
          const lead = await prisma.lead.findUnique({ where: { id } });
          if (lead?.adId && !lead.campaignName) {
            enrichLeadAdData(lead.id, lead.adId).catch(() => {});
          }
        }
      }
    }

    for (const source of saleSources) {
      const url = `https://docs.google.com/spreadsheets/d/${source.id}/export?format=csv&gid=${source.gid}`;
      const res = await axios.get(url, { timeout: 15000 });
      const lines = String(res.data).split(/\r?\n/);
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVRow(lines[i]);
        if (row.length < 4) continue;
        const id = await upsertSheetSale(business.id, source, i, row);
        if (id) {
          processedSaleIds.push(id);
          // Process attribution immediately
          await processAttribution(id).catch(() => {});
        }
      }
    }

    return { 
      success: true, 
      saleCount: processedSaleIds.length, 
      leadCount: processedLeadIds.length,
      ids: processedSaleIds,
      leadIds: processedLeadIds
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
