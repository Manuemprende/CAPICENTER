import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import cors from "cors";

const prisma = new PrismaClient();

function normalizePhone(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, "");
  
  // If it starts with 569 and has 11 digits, it's already good
  if (cleaned.startsWith("569") && cleaned.length === 11) return cleaned;
  
  // If it starts with 9 and has 9 digits, add 56
  if (cleaned.startsWith("9") && cleaned.length === 9) return "56" + cleaned;
  
  // If it's just the 8 numbers after the 9 (e.g. 12345678) and total 8 digits, maybe add 569
  // but usually it should be 9 digits
  
  return cleaned;
}

import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "fallback_key_32_chars_long_12345"; // Should be 32 chars
const IV_LENGTH = 16;

function encrypt(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text: string) {
  const textParts = text.split(":");
  const iv = Buffer.from(textParts.shift()!, "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Helpers for flexible field mapping
function findField(obj: any, synonyms: string[]): any {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedSynonyms = synonyms.map(normalize);

  for (const key of Object.keys(obj)) {
    const normKey = normalize(key);
    if (normalizedSynonyms.includes(normKey)) return obj[key];
  }
  return undefined;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // Middleware to validate API Key
  const validateApiKey = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
      return res.status(401).json({ error: "Missing x-api-key header" });
    }

    const keyDoc = await prisma.apiKey.findUnique({
      where: { key: String(apiKey) },
      include: { business: true }
    });

    if (!keyDoc || !keyDoc.active) {
      return res.status(403).json({ error: "Invalid or inactive API key" });
    }

    (req as any).businessId = keyDoc.businessId;
    next();
  };

  // --- API Routes ---

  // POST /api/webhooks/leads
  app.post("/api/webhooks/leads", validateApiKey, async (req, res) => {
    try {
      const body = req.body;
      const businessId = (req as any).businessId;

      const phone = findField(body, ["phone", "telefono", "whatsapp", "celular", "contacto", "mobile", "numero", "waId"]);
      const customerName = findField(body, ["name", "nombre", "customer", "cliente", "user_name"]);
      const stage = findField(body, ["stage", "etapa", "status", "estado"]);
      const conversationId = findField(body, ["conversationId", "idConversation", "id_conversacion", "id_chat", "conv_id"]);
      const country = findField(body, ["country", "pais", "nacion"]);
      const whatsappId = findField(body, ["whatsappId", "waId", "wa_id", "inboxid"]);
      const ctwaClid = findField(body, ["ctwaClid", "clid", "fbclid", "clickId", "external_id", "ctwa_clid"]);
      const campaignId = findField(body, ["campaignId", "campId", "id_campana", "campaign_id"]);
      const campaignName = findField(body, ["campaignName", "campName", "nombre_campana", "campaign_name"]);
      const adsetId = findField(body, ["adsetId", "adset_id", "id_conjunto"]);
      const adsetName = findField(body, ["adsetName", "adset_name", "nombre_conjunto"]);
      const adId = findField(body, ["adId", "ad_id", "id_anuncio"]);
      const adName = findField(body, ["adName", "ad_name", "nombre_anuncio"]);

      if (!phone) return res.status(400).json({ error: "Phone is required" });

      // Separate known fields from metadata
      const knownKeys = ["phone", "whatsappId", "ctwaClid", "campaignId", "campaignName", "adsetId", "adsetName", "adId", "adName", "adHeadline", "name", "nombre", "stage", "etapa", "country", "pais", "conversationId", "adUrl", "ad_url", "metaEventId", "meta_event_id", "metaStatus", "meta_status", "metaResponse", "meta_response", "metaError", "meta_error", "converted"];
      
      const adUrl = findField(body, ["adUrl", "ad_url"]);
      const adHeadline = findField(body, ["adHeadline", "ad_headline", "headline"]);
      const metaEventId = findField(body, ["metaEventId", "meta_event_id", "event_id"]);
      const metaStatus = findField(body, ["metaStatus", "meta_status"]);
      const metaResponse = findField(body, ["metaResponse", "meta_response"]);
      const metaError = findField(body, ["metaError", "meta_error"]);
      const isConverted = findField(body, ["converted", "convertido"]);

      const phoneNormalized = normalizePhone(String(phone));

      // --- Deduplication ---
      if (metaEventId) {
        const existing = await prisma.lead.findFirst({
          where: {
            businessId,
            metaEventId: String(metaEventId)
          }
        });
        if (existing) {
           return res.status(200).json({ success: true, message: "Duplicate lead ignored", leadId: existing.id });
        }
      }

      // --- Rate Limiter / Circuit Breaker ---
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
      const recentLeadsCount = await prisma.lead.count({
        where: {
          businessId,
          phoneNormalized,
          createdAt: {
            gte: fifteenMinsAgo
          }
        }
      });

      if (recentLeadsCount >= 3) {
         console.warn(`[RATE LIMIT] Phone ${phoneNormalized} exceeded lead frequency.`);
         return res.status(429).json({ error: "Too many leads registered for this number. Circuit breaker activated." });
      }

      const metadata: any = {};
      Object.keys(body).forEach(key => {
        if (!knownKeys.some(k => k.toLowerCase() === key.toLowerCase())) {
          metadata[key] = body[key];
        }
      });

      const lead = await prisma.lead.create({
        data: {
          businessId,
          phone: String(phone),
          phoneNormalized: normalizePhone(String(phone)),
          customerName: customerName ? String(customerName) : null,
          stage: stage ? String(stage) : null,
          conversationId: conversationId ? String(conversationId) : null,
          country: country ? String(country) : null,
          isConverted: isConverted ? String(isConverted) : null,
          adUrl: adUrl ? String(adUrl) : null,
          adHeadline: adHeadline ? String(adHeadline) : null,
          metaEventId: metaEventId ? String(metaEventId) : null,
          metaStatus: metaStatus ? String(metaStatus) : null,
          metaResponse: metaResponse ? String(metaResponse) : null,
          metaError: metaError ? String(metaError) : null,
          whatsappId: whatsappId ? String(whatsappId) : null,
          ctwaClid: ctwaClid ? String(ctwaClid) : null,
          campaignId: campaignId ? String(campaignId) : null,
          campaignName: campaignName ? String(campaignName) : null,
          adsetId: adsetId ? String(adsetId) : null,
          adsetName: adsetName ? String(adsetName) : null,
          adId: adId ? String(adId) : null,
          adName: adName ? String(adName) : null,
          metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
        }
      });

      res.json({ success: true, lead });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/webhooks/sales
  app.post("/api/webhooks/sales", validateApiKey, async (req, res) => {
    try {
      const body = req.body;
      const businessId = (req as any).businessId;

      const phone = findField(body, ["phone", "telefono", "whatsapp", "celular", "contacto", "mobile", "numero", "waId"]);
      const amount = findField(body, ["amount", "value", "monto", "valor", "total", "precio", "monto_total", "venta"]);
      const customerName = findField(body, ["name", "nombre", "customer", "cliente", "user_name"]);
      const stage = findField(body, ["stage", "etapa", "status", "estado"]);
      const conversationId = findField(body, ["conversationId", "idConversation", "id_conversacion", "id_chat", "conv_id"]);
      const country = findField(body, ["country", "pais", "nacion"]);
      const isConverted = findField(body, ["converted", "convertido"]);
      const externalId = findField(body, ["externalId", "id", "transaccion", "pedido", "orderId", "id_venta", "trans_id"]);
      const currency = findField(body, ["currency", "moneda", "divisa"]) || "CLP";
      const whatsappId = findField(body, ["whatsappId", "waId", "inboxid"]);
      const paymentStatus = findField(body, ["paymentStatus", "status", "estado", "pago_estado"]) || "paid";
      const ctwaClid = findField(body, ["ctwaClid", "clid", "fbclid", "clickId"]);

      if (!phone || amount === undefined) return res.status(400).json({ error: "Phone and amount are required" });

      const phoneNormalized = normalizePhone(String(phone));

      // Separate known fields from metadata
      const knownKeys = ["phone", "amount", "externalId", "currency", "whatsappId", "paymentStatus", "ctwaClid", "name", "nombre", "stage", "etapa", "country", "pais", "conversationId", "converted", "adUrl", "ad_url", "adHeadline", "ad_headline", "metaEventId", "meta_event_id", "metaStatus", "meta_status", "metaResponse", "meta_response", "metaError", "meta_error"];
      
      const adUrl = findField(body, ["adUrl", "ad_url"]);
      const adHeadline = findField(body, ["adHeadline", "ad_headline", "headline"]);
      const metaEventId = findField(body, ["metaEventId", "meta_event_id", "event_id"]);
      const metaStatus = findField(body, ["metaStatus", "meta_status"]);
      const metaResponse = findField(body, ["metaResponse", "meta_response"]);
      const metaError = findField(body, ["metaError", "meta_error"]);

      // --- Deduplication ---
      if (metaEventId || externalId) {
        const existing = await prisma.sale.findFirst({
          where: {
            businessId,
            OR: [
              ...(metaEventId ? [{ metaEventId: String(metaEventId) }] : []),
              ...(externalId ? [{ externalId: String(externalId) }] : [])
            ]
          }
        });
        if (existing) {
           return res.status(200).json({ success: true, message: "Duplicate sale ignored", saleId: existing.id });
        }
      }

      // --- Rate Limiter / Circuit Breaker ---
      // Reject if more than 3 sales from the same phone in the last 15 minutes
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
      const recentSalesCount = await prisma.sale.count({
        where: {
          businessId,
          phoneNormalized,
          createdAt: {
            gte: fifteenMinsAgo
          }
        }
      });

      if (recentSalesCount >= 3) {
         // Optionally you could send a telegram alert here
         console.warn(`[RATE LIMIT] Phone ${phoneNormalized} exceeded sale frequency.`);
         return res.status(429).json({ error: "Too many sales registered for this number. Circuit breaker activated." });
      }

      const metadata: any = {};
      Object.keys(body).forEach(key => {
        if (!knownKeys.some(k => k.toLowerCase() === key.toLowerCase())) {
          metadata[key] = body[key];
        }
      });

      const sale = await prisma.sale.create({
        data: {
          businessId,
          externalId: externalId ? String(externalId) : null,
          amount: parseFloat(String(amount)),
          currency: String(currency),
          phone: String(phone),
          phoneNormalized,
          customerName: customerName ? String(customerName) : null,
          stage: stage ? String(stage) : null,
          conversationId: conversationId ? String(conversationId) : null,
          country: country ? String(country) : null,
          isConverted: isConverted ? String(isConverted) : null,
          adUrl: adUrl ? String(adUrl) : null,
          adHeadline: adHeadline ? String(adHeadline) : null,
          metaEventId: metaEventId ? String(metaEventId) : null,
          metaStatus: metaStatus ? String(metaStatus) : null,
          metaResponse: metaResponse ? String(metaResponse) : null,
          metaError: metaError ? String(metaError) : null,
          whatsappId: whatsappId ? String(whatsappId) : null,
          ctwaClid: ctwaClid ? String(ctwaClid) : null,
          paymentStatus: String(paymentStatus),
          metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
        }
      });

      // Attribution Match Logic
      await processAttribution(sale.id);

      const updatedSale = await prisma.sale.findUnique({
        where: { id: sale.id },
        include: { matches: { include: { lead: true } } }
      });

      res.json({ success: true, sale: updatedSale });
    } catch (error: any) {
      console.error("Sales Webhook Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  async function processAttribution(saleId: string) {
    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) return;

    let bestLeadId: string | null = null;
    let bestScore = 0;
    let matchType = "";

    // 1. Match by ctwaClid (Priority 1 - Score 100)
    if (sale.ctwaClid) {
       const clidLead = await prisma.lead.findFirst({
         where: { 
           businessId: sale.businessId,
           ctwaClid: sale.ctwaClid
         },
         orderBy: { createdAt: 'desc' }
       });

       if (clidLead) {
         bestLeadId = clidLead.id;
         bestScore = 100;
         matchType = "clid";
       }
    }

    // 2. If no clid match, check multiple factors
    if (bestScore < 100) {
      const leads = await prisma.lead.findMany({
        where: {
          businessId: sale.businessId,
          OR: [
            { phoneNormalized: sale.phoneNormalized },
            sale.whatsappId ? { whatsappId: sale.whatsappId } : {}
          ]
        },
        orderBy: { createdAt: "desc" }
      });

      for (const lead of leads) {
        let score = 0;
        let type = "";

        if (lead.phoneNormalized === sale.phoneNormalized) {
          score = 85;
          type = "phone";
          
          const diff = sale.createdAt.getTime() - lead.createdAt.getTime();
          const hours = diff / (1000 * 60 * 60);
          if (hours >= 0 && hours <= 48) {
            score = 90; 
            type = "phone_window";
          }
        }

        if (sale.whatsappId && lead.whatsappId === sale.whatsappId) {
          if (80 > score) {
            score = 80;
            type = "whatsapp_id";
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestLeadId = lead.id;
          matchType = type;
        }
      }
    }

    if (bestLeadId) {
      await prisma.attributionMatch.create({
        data: {
          saleId: sale.id,
          leadId: bestLeadId,
          matchScore: bestScore,
          matchType: matchType
        }
      });

      // Determine attribution status
      let status = "no_match";
      if (bestScore >= 90) status = "strong_match";
      else if (bestScore >= 70) status = "attributed";
      else if (bestScore >= 40) status = "weak_match";

      // Check if scalable
      const lead = await prisma.lead.findUnique({ where: { id: bestLeadId } });
      const isScalable = (sale.paymentStatus === "paid" && sale.amount > 0 && (status === "strong_match" || status === "attributed") && (lead?.adId || lead?.campaignId)) ? true : false;

      await prisma.sale.update({
        where: { id: sale.id },
        data: {
          attributionStatus: status,
          isScalable: isScalable
        }
      });

      // --- AUTOMATIC CAPI TRANSMISSION ---
      if (isScalable) {
        console.log(`[CAPI] Triggering automatic transmission for sale ${sale.id}`);
        // We call it without await to not block the main process if it takes time
        sendToCapi(sale.id).catch(err => console.error(`[CAPI ERROR] Auto transmission failed for ${sale.id}:`, err));
      }
    } else {
      await prisma.sale.update({
        where: { id: sale.id },
        data: {
          attributionStatus: "manual_review"
        }
      });
    }
  }

  function reqBodyHasClid(sale: any) {
    return false; // Placeholder
  }

  // POST /api/webhooks/n8n-log
  app.post("/api/webhooks/n8n-log", validateApiKey, async (req, res) => {
    try {
      const { workflowId, workflowName, executionId, status, payload, error } = req.body;
      const log = await prisma.n8nWorkflowLog.create({
        data: {
          workflowId,
          workflowName,
          executionId,
          status,
          payload: payload ? JSON.stringify(payload) : null,
          error
        }
      });
      res.json({ success: true, log });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/dashboard/summary
  app.get("/api/dashboard/summary", async (req, res) => {
    try {
      const { from, to } = req.query;
      let where: any = {};
      
      const startDate = from ? new Date(from as string) : new Date();
      if (!from) startDate.setHours(0, 0, 0, 0);

      const endDate = to ? new Date(to as string) : new Date();
      if (!to) endDate.setHours(23, 59, 59, 999);
      else {
        endDate.setHours(23, 59, 59, 999);
      }

      where.createdAt = { gte: startDate, lte: endDate };
      
      // Fix: If we want to strictly follow 'paid', we check both. 
      // But for current imported data, let's include 'pending' as 'real' if it has an amount > 0, 
      // OR better, let's treat 'pending' as real for this demo since importer didn't set it.
      // Actually, I'll update the database to set all existing sales to 'paid' in a separate step or handle it here.
      const paidWhere = { ...where, paymentStatus: { in: ['paid', 'pending'] } }; 

      const [
        leadsCount, 
        salesSum, 
        salesCount, 
        attributedSales, 
        failedCapi, 
        sentCapi,
        adPerformance,
        recentLeads, 
        recentSales, 
        scalableAdsCount,
        revisionManualCount,
        topProducts
      ] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.sale.aggregate({ where: paidWhere, _sum: { amount: true } }),
        prisma.sale.count({ where: paidWhere }),
        prisma.sale.count({ where: { ...paidWhere, attributionStatus: { in: ["strong_match", "attributed", "weak_match"] } } }),
        prisma.sale.count({ where: { ...paidWhere, capiStatus: "failed" } }),
        prisma.sale.count({ where: { ...paidWhere, capiStatus: "sent" } }),
        prisma.adPerformance.aggregate({ 
          where: { date: { gte: startDate, lte: endDate } }, 
          _sum: { spend: true, impressions: true, clicks: true, metaConversions: true } 
        }),
        prisma.lead.findMany({ where, take: 5, orderBy: { createdAt: "desc" } }),
        prisma.sale.findMany({ where, take: 5, orderBy: { createdAt: "desc" }, include: { matches: true } }),
        prisma.sale.count({ where: { ...paidWhere, isScalable: true } }),
        prisma.sale.count({ where: { ...paidWhere, requiereRevisionManual: true } }),
        // Attempt to get product distribution from adName or metadata if possible
        prisma.sale.groupBy({
          by: ['adName'],
          where: { ...paidWhere, adName: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { adName: 'desc' } },
          take: 5
        })
      ]);

      const ingresoReal = salesSum._sum.amount || 0;
      const gastoMeta = adPerformance._sum.spend || 0;
      const matchRate = salesCount > 0 ? (attributedSales / salesCount) * 100 : 0;
      const capiGapCount = attributedSales - sentCapi;
      const capiGapPercent = attributedSales > 0 ? (capiGapCount / attributedSales) * 100 : 0;
      const roasReal = gastoMeta > 0 ? ingresoReal / gastoMeta : 0;
      const cpaReal = salesCount > 0 ? gastoMeta / salesCount : 0;
      const ticketPromedio = salesCount > 0 ? ingresoReal / salesCount : 0;

      res.json({
        summary: {
          salesToday: salesCount,
          totalAmount: ingresoReal,
          attributedSales,
          sentToMeta: sentCapi,
          failedCapi,
          notSentToMeta: capiGapCount,
          matchRate: matchRate.toFixed(1),
          capiGapPercent: capiGapPercent.toFixed(1),
          capiGapCount,
          roasReal: roasReal.toFixed(2),
          cpaReal: cpaReal.toFixed(0),
          spend: gastoMeta,
          scalableAds: scalableAdsCount,
          revisionManual: revisionManualCount,
          metaConversions: adPerformance._sum.metaConversions || 0,
          ticketPromedio: ticketPromedio.toFixed(0),
          topProducts: topProducts.map(p => ({ name: p.adName, count: p._count._all }))
        },
        recentLeads,
        recentSales
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/settings/alerts
  app.get("/api/settings/alerts", async (req, res) => {
    try {
      let config = await prisma.alertConfig.findFirst();
      if (!config) {
        config = await prisma.alertConfig.create({ data: { telegramEnabled: true, whatsappEnabled: false } });
      }
      res.json(config);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/settings/alerts
  app.post("/api/settings/alerts", async (req, res) => {
    try {
      const { id, telegramBotToken, telegramChatId, telegramEnabled, whatsappEnabled } = req.body;
      const data = { telegramBotToken, telegramChatId, telegramEnabled, whatsappEnabled };
      
      const config = await prisma.alertConfig.upsert({
        where: { id: id || 'default' },
        update: data,
        create: data
      });
      res.json(config);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  async function sendTelegramAlert(message: string) {
    try {
      const config = await prisma.alertConfig.findFirst();
      if (config?.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
        await axios.post(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
          chat_id: config.telegramChatId,
          text: `🚨 *ALERTA ATRIBUCIÓN*\n\n${message}`,
          parse_mode: 'Markdown'
        });
      }
    } catch (e) {
      console.error('Error sending telegram alert:', e);
    }
  }

  // GET /api/performance/ads
  app.get("/api/performance/ads", async (req, res) => {
    try {
      const { from, to } = req.query;
      const startDate = from ? new Date(from as string) : new Date();
      if (!from) startDate.setHours(0, 0, 0, 0);
      const endDate = to ? new Date(to as string) : new Date();
      endDate.setHours(23, 59, 59, 999);

      // 1. Obtener gasto por anuncio
      const performance = await prisma.adPerformance.findMany({
        where: { date: { gte: startDate, lte: endDate } }
      });

      // 2. Obtener ventas atribuidas por anuncio
      const sales = await prisma.sale.findMany({
        where: { 
          paymentStatus: 'paid',
          createdAt: { gte: startDate, lte: endDate },
          adId: { not: null }
        }
      });

      // 3. Consolidar por Ad ID
      const adMap: Record<string, any> = {};

      performance.forEach(p => {
        if (!adMap[p.adId]) {
          adMap[p.adId] = { 
            adId: p.adId, 
            adName: p.adName, 
            spend: 0, 
            metaSales: 0, 
            realSales: 0, 
            revenue: 0,
            capiSent: 0 
          };
        }
        adMap[p.adId].spend += p.spend;
        adMap[p.adId].metaSales += p.metaConversions;
      });

      sales.forEach(s => {
        const adId = s.adId!;
        if (!adMap[adId]) {
          adMap[adId] = { adId, adName: s.adName, spend: 0, metaSales: 0, realSales: 0, revenue: 0, capiSent: 0 };
        }
        adMap[adId].realSales += 1;
        adMap[adId].revenue += s.amount;
        if (s.capiStatus === 'sent') adMap[adId].capiSent += 1;
      });

      const result = Object.values(adMap).map(ad => {
        const capiGap = ad.realSales > 0 ? ((ad.realSales - ad.capiSent) / ad.realSales) * 100 : 0;
        const roasReal = ad.spend > 0 ? ad.revenue / ad.spend : 0;
        const cpaReal = ad.realSales > 0 ? ad.spend / ad.realSales : 0;
        
        let status = 'hold';
        if (ad.spend > 0 && roasReal > 2.0 && capiGap < 15) status = 'scale';
        else if (ad.spend > 0 && roasReal < 1.0) status = 'do_not_scale';
        else if (capiGap > 25) status = 'data_problem';

        return { ...ad, capiGap: capiGap.toFixed(1), roasReal: roasReal.toFixed(2), cpaReal: cpaReal.toFixed(0), status };
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/performance/seed
  app.get("/api/performance/seed", async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const ads = [
        { id: 'ad_123', name: 'Reto 28 Dias - Video A' },
        { id: 'ad_456', name: 'Lee Rapido - Carrusel' },
        { id: 'ad_789', name: 'Recetas Gluten Free - Estatico' }
      ];

      for (const ad of ads) {
        await prisma.adPerformance.upsert({
          where: { adId_date: { adId: ad.id, date: today } },
          update: { spend: 15000, metaConversions: 2 },
          create: { adId: ad.id, adName: ad.name, date: today, spend: 15000, metaConversions: 2 }
        });
      }
      res.json({ success: true, message: "Datos de rendimiento sembrados para hoy" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/settings/meta
  app.get("/api/settings/meta", async (req, res) => {
    try {
      const configs = await prisma.metaConfig.findMany({
        orderBy: { createdAt: 'desc' }
      });
      
      const maskedConfigs = configs.map(config => {
        const token = decrypt(config.accessToken);
        const masked = token.substring(0, 4) + "************" + token.substring(token.length - 3);
        return { ...config, accessToken: masked };
      });
      
      res.json(maskedConfigs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/settings/meta
  app.post("/api/settings/meta", async (req, res) => {
    try {
      const { id, pixelId, accessToken, businessManagerId, datasetId, testEventCode, active, adminName, phoneNumber } = req.body;
      
      let finalToken = accessToken;
      let existing = null;
      
      if (id) {
        existing = await prisma.metaConfig.findUnique({ where: { id } });
      }

      if (accessToken && !accessToken.includes("****")) {
        finalToken = encrypt(accessToken);
      } else if (existing) {
        finalToken = existing.accessToken;
      }

      const business = await prisma.business.findFirst(); 
      if (!business) return res.status(404).json({ error: "Business not found" });

      const data = {
        pixelId,
        accessToken: finalToken,
        businessManagerId,
        datasetId,
        testEventCode,
        adminName,
        phoneNumber,
        active: active !== undefined ? active : true,
        businessId: business.id
      };

      if (id) {
        await prisma.metaConfig.update({ where: { id }, data });
      } else {
        await prisma.metaConfig.create({ data });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/settings/meta/:id
  app.delete("/api/settings/meta/:id", async (req, res) => {
    try {
      await prisma.metaConfig.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/capi/retry/:saleId
  app.post("/api/capi/retry/:saleId", async (req, res) => {
    try {
      const { saleId } = req.params;
      await sendToCapi(saleId);
      const sale = await prisma.sale.findUnique({ where: { id: saleId } });
      res.json({ success: true, sale });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  async function sendToCapi(saleId: string) {
    const sale = await prisma.sale.findUnique({ 
      where: { id: saleId },
      include: { business: { include: { metaConfigs: true } } }
    });
    
    if (!sale || !sale.isScalable) return;
    
    // Check if CAPI is already sent successfully
    const eventId = `purchase_${sale.id}_${sale.phoneNormalized}`;
    const existingEntry = await prisma.capiEvent.findUnique({ where: { eventId } });
    
    if (existingEntry && existingEntry.status === "sent") {
      await prisma.sale.update({ where: { id: sale.id }, data: { capiStatus: "duplicate_blocked" } });
      return;
    }

    // Smart Config Selection: Try to match by sale phone, fallback to active one
    let config = sale.business.metaConfigs.find(c => c.active && c.phoneNumber && normalizePhone(c.phoneNumber) === sale.phoneNormalized);
    if (!config) {
      config = sale.business.metaConfigs.find(c => c.active);
    }
    
    if (!config) return;

    try {
      const payload = {
        data: [{
          event_name: "Purchase",
          event_time: Math.floor(sale.createdAt.getTime() / 1000),
          action_source: "system",
          event_id: eventId,
          user_data: {
            ph: [crypto.createHash('sha256').update(sale.phoneNormalized).digest('hex')],
          },
          custom_data: {
            value: sale.amount,
            currency: sale.currency,
          }
        }],
        test_event_code: config.testEventCode || undefined
      };

      // In real scenario, we perform:
      const metaResponse = await axios.post(`https://graph.facebook.com/v17.0/${config.pixelId}/events?access_token=${decrypt(config.accessToken)}`, payload);
      
      const responseData = metaResponse.data;
      
      await prisma.capiEvent.upsert({
        where: { eventId },
        update: {
          payload: JSON.stringify(payload),
          response: JSON.stringify(responseData),
          httpStatus: metaResponse.status,
          status: "sent",
          sentAt: new Date()
        },
        create: {
          saleId: sale.id,
          eventId,
          payload: JSON.stringify(payload),
          response: JSON.stringify(responseData),
          httpStatus: metaResponse.status,
          status: "sent",
          sentAt: new Date()
        }
      });

      await prisma.sale.update({ where: { id: sale.id }, data: { capiStatus: "sent" } });

    } catch (error: any) {
      console.error("CAPI Error:", error);
      await prisma.capiEvent.upsert({
        where: { eventId },
        update: {
          error: error.message,
          status: "failed",
        },
        create: {
          saleId: sale.id,
          eventId,
          payload: "",
          error: error.message,
          status: "failed",
        }
      });
      await prisma.sale.update({ where: { id: sale.id }, data: { capiStatus: "failed" } });
    }
  }

  // GET /api/leads
  app.get("/api/leads", async (req, res) => {
    try {
      const { from, to } = req.query;
      let where: any = {};
      
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from as string);
        if (to) {
          const toDate = new Date(to as string);
          toDate.setHours(23, 59, 59, 999);
          where.createdAt.lte = toDate;
        }
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        where.createdAt = { gte: today };
      }

      const leads = await prisma.lead.findMany({ 
        where,
        orderBy: { createdAt: "desc" } 
      });
      res.json(leads);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/sales
  app.get("/api/sales", async (req, res) => {
    try {
      const { from, to } = req.query;
      let where: any = {};
      
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from as string);
        if (to) {
          const toDate = new Date(to as string);
          toDate.setHours(23, 59, 59, 999);
          where.createdAt.lte = toDate;
        }
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        where.createdAt = { gte: today };
      }

      const sales = await prisma.sale.findMany({ 
        where,
        orderBy: { createdAt: "desc" },
        include: { matches: { include: { lead: true } } }
      });
      res.json(sales);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
