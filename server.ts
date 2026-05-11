import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import { syncGoogleSheets } from "./src/lib/sync-sheets.ts";



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

function parseAmount(value: any): number {
  const raw = cleanString(value);
  if (!raw) return 0;
  let normalized = raw.replace(/[^\d,.-]/g, "");
  const negative = normalized.startsWith("-");
  normalized = normalized.replace(/-/g, "");
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    const parsed = Number(
      normalized
        .replace(new RegExp(`\\${thousandsSeparator}`, "g"), "")
        .replace(decimalSeparator, ".")
    );
    return negative ? -parsed : parsed;
  }

  if (hasComma) {
    const parts = normalized.split(",");
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      const parsed = Number(parts.join(""));
      return negative ? -parsed : parsed;
    }
    const parsed = Number(normalized.replace(",", "."));
    return negative ? -parsed : parsed;
  }

  if (hasDot) {
    const parts = normalized.split(".");
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      const parsed = Number(parts.join(""));
      return negative ? -parsed : parsed;
    }
  }

  const parsed = Number(normalized);
  return negative ? -parsed : parsed;
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
  if (!obj || typeof obj !== "object") return undefined;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedSynonyms = synonyms.map(normalize);

  for (const key of Object.keys(obj)) {
    const normKey = normalize(key);
    if (normalizedSynonyms.includes(normKey)) return obj[key];
  }
  return undefined;
}

function cleanString(value: any): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function firstPresent(...values: any[]): string {
  for (const value of values) {
    const cleaned = cleanString(value);
    if (cleaned) return cleaned;
  }
  return "";
}

const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Santiago";

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
  const utcMillis = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  return utcMillis - date.getTime();
}

function dateOnlyInTimeZoneToUtc(year: number, month: number, day: number, endOfDay = false, timeZone = APP_TIMEZONE): Date {
  const hour = endOfDay ? 23 : 0;
  const minute = endOfDay ? 59 : 0;
  const second = endOfDay ? 59 : 0;
  const millisecond = endOfDay ? 999 : 0;
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let date = new Date(localAsUtc - getTimeZoneOffsetMs(new Date(localAsUtc), timeZone));
  date = new Date(localAsUtc - getTimeZoneOffsetMs(date, timeZone));
  return date;
}

function parseDateParam(value: any, endOfDay = false): Date {
  const raw = cleanString(value);
  if (!raw) {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
    return dateOnlyInTimeZoneToUtc(values.year, values.month, values.day, endOfDay);
  }

  // Match YYYY-MM-DD
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return dateOnlyInTimeZoneToUtc(Number(year), Number(month), Number(day), endOfDay);
  }

  // Match DD-MM-YYYY or DD/MM/YYYY
  const matchDDMM = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (matchDDMM) {
    const [, day, month, year] = matchDDMM;
    return dateOnlyInTimeZoneToUtc(Number(year), Number(month), Number(day), endOfDay);
  }

  // Match DD-MM-YYYY HH:mm:ss or DD/MM/YYYY HH:mm:ss
  const matchDDMMTime = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})\s+(.+)$/);
  if (matchDDMMTime) {
    const [, day, month, year, time] = matchDDMMTime;
    const date = new Date(`${year}-${month}-${day}T${time}`);
    if (!isNaN(date.getTime())) {
      if (endOfDay) date.setHours(23, 59, 59, 999);
      return date;
    }
  }

  const date = new Date(raw);
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

function makeSaleFallbackId(payload: {
  conversationId?: string;
  phone?: string;
  amount?: any;
  createdAt?: any;
}) {
  const stableParts = [
    cleanString(payload.conversationId) || "no-conv",
    normalizePhone(cleanString(payload.phone) || "no-phone"),
    String(parseAmount(payload.amount) || "no-amount"),
    cleanString(payload.createdAt) || new Date().toISOString().slice(0, 10),
  ];

  return `chatwoot-${stableParts.join("-")}`;
}

function extractLabels(body: any): string[] {
  const candidates = [
    body?.labels,
    body?.conversation?.labels,
    body?.changed_attributes?.labels?.current_value,
    body?.changed_attributes?.labels,
    body?.label_list,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.map((label) => cleanString(label).toLowerCase()).filter(Boolean);
    if (typeof candidate === "string") return candidate.split(",").map((label) => cleanString(label).toLowerCase()).filter(Boolean);
  }

  return [];
}

function normalizeN8nPayload(body: any) {
  const contact = body?.meta?.sender || body?.conversation?.contact || body?.contact || body?.sender || {};
  const conversationAttrs = body?.custom_attributes || body?.conversation?.custom_attributes || {};
  const contactAttrs = contact?.custom_attributes || body?.meta?.sender?.custom_attributes || {};
  const attrs = { ...contactAttrs, ...conversationAttrs };
  const labels = extractLabels(body);

  const declaredType = cleanString(findField(body, ["eventType", "event", "type", "tipo", "entity", "resource"])).toLowerCase();
  const saleLabels = new Set(["pagado", "pagada", "paid", "compra", "comprado", "convertido", "venta"]);
  const isSale = declaredType.includes("sale") || declaredType.includes("venta") || labels.some((label) => saleLabels.has(label));

  const conversationId = firstPresent(
    body?.id,
    body?.conversation?.id,
    body?.conversationId,
    body?.conversation_id,
    attrs?.conversationId,
    attrs?.conversation_id,
  );
  const phone = firstPresent(
    findField(body, ["phone", "telefono", "telefono_wa", "whatsapp", "celular", "contacto", "mobile", "numero", "waId"]),
    contact?.phone_number,
    contact?.phone,
    attrs?.phone,
    attrs?.telefono,
    attrs?.whatsapp_number,
  );
  const customerName = firstPresent(
    findField(body, ["name", "nombre", "customer", "cliente", "user_name"]),
    contact?.name,
    attrs?.name,
    attrs?.nombre,
    attrs?.customer_name,
  );
  const amount = firstPresent(
    findField(body, ["amount", "value", "monto", "valor", "total", "precio", "monto_total", "venta"]),
    attrs?.amount,
    attrs?.monto,
    attrs?.monto_venta,
    attrs?.value,
  );
  const adId = firstPresent(findField(body, ["adId", "ad_id", "id_anuncio"]), attrs?.adId, attrs?.ad_id, body?.referral?.source_id);
  const eventDate = firstPresent(findField(body, ["createdAt", "date", "fecha", "fechaVenta", "saleDate", "timestamp"]), attrs?.createdAt, attrs?.date, attrs?.fecha);
  const metaEventId = firstPresent(
    findField(body, ["metaEventId", "meta_event_id", "event_id"]),
    attrs?.metaEventId,
    attrs?.meta_event_id,
    isSale
      ? makeSaleFallbackId({ conversationId, phone, amount, createdAt: eventDate }).replace(/^chatwoot-/, "purchase-")
      : conversationId || phone ? `lead-${conversationId || "no-conv"}-${normalizePhone(phone || "no-phone")}` : "",
  );

  const payload: any = {
    phone,
    name: customerName,
    stage: firstPresent(findField(body, ["stage", "etapa", "status", "estado"]), attrs?.stage, labels.join(",")),
    conversationId,
    country: firstPresent(findField(body, ["country", "pais", "nacion"]), attrs?.country, attrs?.pais, attrs?.country_code, "CL"),
    whatsappId: firstPresent(findField(body, ["whatsappId", "waId", "wa_id", "inboxid"]), attrs?.whatsappId, attrs?.wa_id),
    ctwaClid: firstPresent(findField(body, ["ctwaClid", "clid", "fbclid", "clickId", "ctwa_clid"]), attrs?.ctwaClid, attrs?.ctwa_clid, body?.referral?.ctwa_clid),
    campaignId: firstPresent(findField(body, ["campaignId", "campId", "id_campana", "campaign_id"]), attrs?.campaignId, attrs?.campaign_id),
    campaignName: firstPresent(findField(body, ["campaignName", "campName", "nombre_campana", "campaign_name"]), attrs?.campaignName, attrs?.campaign_name),
    adsetId: firstPresent(findField(body, ["adsetId", "adset_id", "id_conjunto"]), attrs?.adsetId, attrs?.adset_id),
    adsetName: firstPresent(findField(body, ["adsetName", "adset_name", "nombre_conjunto"]), attrs?.adsetName, attrs?.adset_name),
    adId,
    adName: firstPresent(findField(body, ["adName", "ad_name", "nombre_anuncio"]), attrs?.adName, attrs?.ad_name),
    adHeadline: firstPresent(findField(body, ["adHeadline", "ad_headline", "headline"]), attrs?.adHeadline, attrs?.ad_headline, body?.referral?.headline),
    adUrl: firstPresent(findField(body, ["adUrl", "ad_url"]), attrs?.adUrl, attrs?.ad_url, body?.referral?.source_url),
    metaEventId,
    createdAt: eventDate,
    converted: firstPresent(findField(body, ["converted", "convertido"]), isSale ? "true" : ""),
    rawEvent: body,
  };

  if (isSale) {
    payload.amount = amount;
    payload.externalId = firstPresent(
      findField(body, ["externalId", "pedido_num", "order_id", "transaccion", "pedido", "orderId", "id_venta", "trans_id"]),
      attrs?.externalId,
      attrs?.external_id,
      conversationId || phone ? makeSaleFallbackId({ conversationId, phone, amount, createdAt: eventDate }) : ""
    );
    payload.currency = firstPresent(findField(body, ["currency", "moneda", "divisa"]), attrs?.currency, "CLP");
    payload.paymentStatus = firstPresent(findField(body, ["paymentStatus", "pago_estado"]), attrs?.paymentStatus, "paid");
  }

  return { kind: isSale ? "sales" : "leads", payload, labels };
}

// Tokens de campañas extra (ads_read) desde env var como JSON array
const ADS_TOKENS: string[] = (() => {
  try { return JSON.parse(process.env.FACEBOOK_ADS_TOKENS || "[]"); } catch { return []; }
})();

async function enrichLeadAdData(leadId: string, adId: string) {
  // Recolectar todos los tokens disponibles: MetaConfigs + ADS_TOKENS
  const configs = await prisma.metaConfig.findMany({ where: { active: true } });
  const tokens = [
    ...configs.map(c => { try { return decrypt(c.accessToken); } catch { return ""; } }).filter(Boolean),
    ...ADS_TOKENS,
  ];

  for (const token of tokens) {
    try {
      const { data } = await axios.get(
        `https://graph.facebook.com/v17.0/${adId}?fields=name,campaign{name,id},adset{name,id}&access_token=${token}`,
        { timeout: 8000 }
      );
      if (!data?.campaign?.name) continue;
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          adName:       data.name           || null,
          campaignId:   data.campaign?.id   || null,
          campaignName: data.campaign?.name || null,
          adsetId:      data.adset?.id      || null,
          adsetName:    data.adset?.name    || null,
        }
      });
      console.log(`[AD ENRICH] OK ${leadId}: ${data.campaign?.name} / ${data.name}`);
      return;
    } catch { continue; }
  }
  console.warn(`[AD ENRICH] Ningún token pudo enriquecer lead ${leadId} adId ${adId}`);
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

  // GET /api/health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() });
  });

  // POST /api/auth/login
  app.post("/api/auth/login", (req, res) => {
    const { password } = req.body;
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || "wentix2026";
    if (password === ADMIN_PASS) {
      const token = Buffer.from(`wentix:${Date.now()}:${ADMIN_PASS}`).toString("base64");
      res.json({ success: true, token });
    } else {
      res.status(401).json({ error: "Credenciales incorrectas" });
    }
  });

  // GET /api/auth/me — verifica si el token es válido
  app.get("/api/auth/me", (req, res) => {
    const auth = req.headers.authorization?.replace("Bearer ", "") || "";
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || "wentix2026";
    try {
      const decoded = Buffer.from(auth, "base64").toString("utf-8");
      if (decoded.startsWith("wentix:") && decoded.endsWith(`:${ADMIN_PASS}`)) {
        return res.json({ authenticated: true });
      }
    } catch {}
    res.status(401).json({ authenticated: false });
  });

  // POST /api/admin/enrich-leads — enriquece todos los leads con adId sin campaignName
  app.post("/api/admin/enrich-leads", async (req, res) => {
    try {
      const leads = await prisma.lead.findMany({
        where: { adId: { not: null }, campaignName: null }
      });
      res.json({ message: `Enriching ${leads.size ?? leads.length} leads in background` });
      for (const lead of leads) {
        if (lead.adId) await enrichLeadAdData(lead.id, lead.adId).catch(() => {});
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/reattribute-sales — re-procesa atribución para todas las ventas pendientes
  app.post("/api/admin/reattribute-sales", async (_req: express.Request, res: express.Response) => {
    try {
      // Procesar: no_match (pueden tener leads ahora), strong_match sin adId, y pending capiStatus
      const sales = await prisma.sale.findMany({
        where: {
          OR: [
            { attributionStatus: "no_match" },
            { attributionStatus: "manual_review" },
            { attributionStatus: { in: ["strong_match", "attributed"] }, adId: null },
          ]
        },
        take: 500
      });
      res.json({ message: `Re-attributing ${sales.length} sales in background` });
      let matched = 0;
      for (const sale of sales) {
        await processAttribution(sale.id).catch(() => {});
        matched++;
      }
      console.log(`[REATTRIBUTE] Processed ${matched} sales`);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/sync-sheets — fuerza la sincronización manual
  app.post("/api/admin/sync-sheets", async (req, res) => {
    try {
      const result = await syncGoogleSheets();
      if (result.success && result.ids) {
        for (const id of result.ids) {
          await processAttribution(id);
          notifyTelegram(id).catch(() => {});
        }
      }
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // POST /api/setup — Bootstrap: create the first Business + ApiKey (only if none exist)
  app.post("/api/setup", async (req, res) => {
    try {
      const existingBusiness = await prisma.business.findFirst();
      if (existingBusiness) {
        const existingKey = await prisma.apiKey.findFirst({ where: { businessId: existingBusiness.id } });
        return res.json({
          message: "Business already exists",
          business: existingBusiness,
          apiKey: existingKey?.key
        });
      }

      const { businessName = "Wentix AI", apiKey: customKey, email = "admin@wentixai.pro" } = req.body;
      const generatedKey = customKey || `capi-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      // Ensure a user exists to associate with the business
      let user = await prisma.user.findFirst({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: { 
            email,
            name: "Admin Wentix"
          }
        });
      }

      const business = await prisma.business.create({
        data: { 
          name: businessName,
          user: { connect: { id: user.id } }
        }
      });

      const apiKey = await prisma.apiKey.create({
        data: { key: generatedKey, businessId: business.id, active: true }
      });

      res.json({ success: true, business, apiKey: apiKey.key });
    } catch (error: any) {
      console.error("Setup Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/businesses — List all businesses and their API keys
  app.get("/api/businesses", async (req, res) => {
    try {
      const businesses = await prisma.business.findMany({
        include: { apiKeys: true }
      });
      res.json(businesses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/businesses/:id/keys — Add a new API key to a business
  app.post("/api/businesses/:id/keys", async (req, res) => {
    try {
      const { id } = req.params;
      const { key: customKey } = req.body;
      const key = customKey || `capi-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const apiKey = await prisma.apiKey.create({
        data: { key, businessId: id, active: true }
      });
      res.json({ success: true, apiKey });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/webhooks/profitbot — endpoint sin auth para profit_aibot
  app.post("/api/webhooks/profitbot", async (req, res) => {
    try {
      const normalized = normalizeN8nPayload(req.body);
      const business = await prisma.business.findFirst();
      if (!business) return res.status(404).json({ error: "Business not found" });
      const internalKey = await prisma.apiKey.findFirst({ where: { businessId: business.id, active: true } });
      if (!internalKey) return res.status(500).json({ error: "No API key configured" });
      const targetUrl = `http://127.0.0.1:${PORT}/api/webhooks/${normalized.kind}`;
      const response = await axios.post(targetUrl, normalized.payload, {
        headers: { "x-api-key": internalKey.key },
        validateStatus: () => true,
      });
      res.status(response.status).json({ success: response.status >= 200 && response.status < 300, routedTo: normalized.kind, result: response.data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/webhooks/n8n
  // Single ingress for Chatwoot/n8n. It infers leads vs sales and reuses the
  // existing typed webhook handlers so dedupe, attribution and CAPI stay aligned.
  app.post("/api/webhooks/n8n", validateApiKey, async (req, res) => {
    try {
      const normalized = normalizeN8nPayload(req.body);
      const apiKey = String(req.headers["x-api-key"]);
      const targetUrl = `http://127.0.0.1:${PORT}/api/webhooks/${normalized.kind}`;
      const response = await axios.post(targetUrl, normalized.payload, {
        headers: { "x-api-key": apiKey },
        validateStatus: () => true,
      });

      res.status(response.status).json({
        success: response.status >= 200 && response.status < 300,
        routedTo: normalized.kind,
        labels: normalized.labels,
        result: response.data,
      });
    } catch (error: any) {
      if (error?.code === "P2002") {
        return res.status(200).json({ success: true, message: "Duplicate lead ignored" });
      }
      res.status(500).json({ error: error.message });
    }
  });

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

      // Enriquecer con datos de campaña desde Meta API en background
      if (lead.adId && !lead.campaignName) {
        enrichLeadAdData(lead.id, lead.adId).catch(() => {});
      }

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
      const saleDate = findField(body, ["createdAt", "date", "fecha", "fechaVenta", "saleDate", "timestamp"]);
      const externalId = findField(body, ["externalId", "pedido_num", "order_id", "transaccion", "pedido", "orderId", "id_venta", "trans_id"]);
      const currency = findField(body, ["currency", "moneda", "divisa"]) || "CLP";
      const whatsappId = findField(body, ["whatsappId", "waId", "inboxid"]);
      const paymentStatus = findField(body, ["paymentStatus", "status", "estado", "pago_estado"]) || "paid";
      const ctwaClid = findField(body, ["ctwaClid", "clid", "fbclid", "clickId"]);
      const campaignId = findField(body, ["campaignId", "campId", "id_campana", "campaign_id"]);
      const campaignName = findField(body, ["campaignName", "campName", "nombre_campana", "campaign_name"]);
      const adsetId = findField(body, ["adsetId", "adset_id", "id_conjunto"]);
      const adsetName = findField(body, ["adsetName", "adset_name", "nombre_conjunto"]);
      const adId = findField(body, ["adId", "ad_id", "id_anuncio"]);
      const adName = findField(body, ["adName", "ad_name", "nombre_anuncio"]);

      let parsedAmount = parseAmount(amount);
      if ((!Number.isFinite(parsedAmount) || parsedAmount <= 0) && process.env.DEFAULT_SALE_AMOUNT) {
        parsedAmount = parseAmount(process.env.DEFAULT_SALE_AMOUNT);
      }
      if (!phone || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Phone and valid amount are required" });
      }

      const phoneNormalized = normalizePhone(String(phone));
      const createdAt = saleDate ? parseDateParam(saleDate) : undefined;
      const finalExternalId = externalId
        ? String(externalId)
        : makeSaleFallbackId({ conversationId: cleanString(conversationId), phone: String(phone), amount, createdAt: cleanString(saleDate) });

      // Separate known fields from metadata
      const knownKeys = ["phone", "amount", "externalId", "currency", "whatsappId", "paymentStatus", "ctwaClid", "name", "nombre", "stage", "etapa", "country", "pais", "conversationId", "createdAt", "date", "fecha", "fechaVenta", "saleDate", "timestamp", "converted", "adUrl", "ad_url", "adHeadline", "ad_headline", "adId", "ad_id", "adName", "ad_name", "campaignId", "campaign_id", "campaignName", "campaign_name", "adsetId", "adset_id", "adsetName", "adset_name", "metaEventId", "meta_event_id", "metaStatus", "meta_status", "metaResponse", "meta_response", "metaError", "meta_error"];
      
      const adUrl = findField(body, ["adUrl", "ad_url"]);
      const adHeadline = findField(body, ["adHeadline", "ad_headline", "headline"]);
      const metaEventId = findField(body, ["metaEventId", "meta_event_id", "event_id"]);
      const metaStatus = findField(body, ["metaStatus", "meta_status"]);
      const metaResponse = findField(body, ["metaResponse", "meta_response"]);
      const metaError = findField(body, ["metaError", "meta_error"]);

      // --- Deduplication ---
      if (metaEventId || finalExternalId) {
        const existing = await prisma.sale.findFirst({
          where: {
            businessId,
            OR: [
              ...(metaEventId ? [{ metaEventId: String(metaEventId) }] : []),
              ...(finalExternalId ? [{ externalId: finalExternalId }] : [])
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
          externalId: finalExternalId,
          amount: parsedAmount,
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
          campaignId: campaignId ? String(campaignId) : null,
          campaignName: campaignName ? String(campaignName) : null,
          adsetId: adsetId ? String(adsetId) : null,
          adsetName: adsetName ? String(adsetName) : null,
          adId: adId ? String(adId) : null,
          adName: adName ? String(adName) : null,
          createdAt,
          metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
        }
      });

      // Attribution Match Logic
      await processAttribution(sale.id);
      
      // Notificaciones Push/Telegram
      notifyTelegram(sale.id).catch(err => console.error("[NOTIFY ERROR] Telegram trigger:", err));

      const updatedSale = await prisma.sale.findUnique({
        where: { id: sale.id },
        include: { matches: { include: { lead: true } } }
      });

      res.json({ success: true, sale: updatedSale });
    } catch (error: any) {
      if (error?.code === "P2002") {
        return res.status(200).json({ success: true, message: "Duplicate sale ignored" });
      }
      console.error("Sales Webhook Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  async function processAttribution(saleId: string) {
    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) return;

    // Evitar duplicados: borrar matches previos antes de re-procesar
    await prisma.attributionMatch.deleteMany({ where: { saleId } });

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
      const isScalable = (sale.paymentStatus === "paid" && (status === "strong_match" || status === "attributed") && (lead?.adId || lead?.campaignId)) ? true : false;

      // Copiar TODOS los datos del lead a la venta para CAPI completo
      const saleUpdate: any = { attributionStatus: status, isScalable };
      if (lead) {
        if (!sale.customerName && lead.customerName)   saleUpdate.customerName = lead.customerName;
        if (!sale.ctwaClid     && lead.ctwaClid)       saleUpdate.ctwaClid     = lead.ctwaClid;
        if (!sale.adId         && lead.adId)           saleUpdate.adId         = lead.adId;
        if (!sale.adName       && lead.adName)         saleUpdate.adName       = lead.adName;
        if (!sale.adUrl        && lead.adUrl)          saleUpdate.adUrl        = lead.adUrl;
        if (!sale.adHeadline   && lead.adHeadline)     saleUpdate.adHeadline   = lead.adHeadline;
        if (!sale.campaignId   && lead.campaignId)     saleUpdate.campaignId   = lead.campaignId;
        if (!sale.campaignName && lead.campaignName)   saleUpdate.campaignName = lead.campaignName;
        if (!sale.adsetId      && lead.adsetId)        saleUpdate.adsetId      = lead.adsetId;
        if (!sale.adsetName    && lead.adsetName)      saleUpdate.adsetName    = lead.adsetName;
        if (!sale.country      && lead.country)        saleUpdate.country      = lead.country;
      }

      await prisma.sale.update({ where: { id: sale.id }, data: saleUpdate });

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
      
      const startDate = parseDateParam(from);
      const endDate = parseDateParam(to, true);

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
        // sent + duplicate_blocked = llegaron a Meta
        prisma.sale.count({ where: { ...paidWhere, capiStatus: { in: ["sent", "duplicate_blocked"] } } }),
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
          leadsCount,
          conversionRate: leadsCount > 0 ? ((salesCount / leadsCount) * 100).toFixed(1) : "0.0",
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
      const startDate = parseDateParam(from);
      const endDate = parseDateParam(to, true);

      // 1. Obtener gasto por anuncio
      const performance = await prisma.adPerformance.findMany({
        where: { date: { gte: startDate, lte: endDate } }
      });

      // 2. Obtener ventas atribuidas - via Sale.adId o via Lead matcheado
      const salesDirect = await prisma.sale.findMany({
        where: { paymentStatus: 'paid', createdAt: { gte: startDate, lte: endDate }, adId: { not: null } }
      });
      const salesViaLead = await prisma.attributionMatch.findMany({
        where: { sale: { paymentStatus: 'paid', createdAt: { gte: startDate, lte: endDate } } },
        include: { sale: true, lead: { select: { adId: true, adName: true } } }
      });

      // 3. Consolidar por Ad ID
      const adMap: Record<string, any> = {};

      performance.forEach(p => {
        if (!adMap[p.adId]) {
          adMap[p.adId] = { adId: p.adId, adName: p.adName, spend: 0, metaSales: 0, realSales: 0, revenue: 0, capiSent: 0 };
        }
        adMap[p.adId].spend += p.spend;
        adMap[p.adId].metaSales += p.metaConversions;
      });

      // Ventas con adId directo en Sale
      salesDirect.forEach(s => {
        const adId = s.adId!;
        if (!adMap[adId]) adMap[adId] = { adId, adName: s.adName, spend: 0, metaSales: 0, realSales: 0, revenue: 0, capiSent: 0 };
        adMap[adId].realSales += 1;
        adMap[adId].revenue += s.amount;
        if (s.capiStatus === 'sent') adMap[adId].capiSent += 1;
      });

      // Ventas atribuidas via Lead (adId en el Lead matcheado)
      const seenSales = new Set(salesDirect.map(s => s.id));
      salesViaLead.forEach(m => {
        if (seenSales.has(m.saleId) || !m.lead?.adId) return;
        seenSales.add(m.saleId);
        const adId = m.lead.adId;
        if (!adMap[adId]) adMap[adId] = { adId, adName: m.lead.adName, spend: 0, metaSales: 0, realSales: 0, revenue: 0, capiSent: 0 };
        adMap[adId].realSales += 1;
        adMap[adId].revenue += m.sale.amount;
        if (m.sale.capiStatus === 'sent') adMap[adId].capiSent += 1;
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

  // POST /api/admin/sync-ads — Sincroniza gasto real desde Meta Ads API
  app.post("/api/admin/sync-ads", async (req, res) => {
    const { date_preset = "last_7d" } = req.body || {};
    const FB = "https://graph.facebook.com/v17.0";

    const ADMINS = [
      { name: "Franco",   token: process.env.ADS_TOKEN_FRANCO   || "", account: "act_1245711336722227" },
      { name: "DropDrop", token: process.env.ADS_TOKEN_DROPDROP || "", account: "act_4026292580960461" },
      { name: "Torres",   token: process.env.ADS_TOKEN_TORRES   || "", account: "act_1270507831043744" },
    ].filter(a => a.token);

    if (!ADMINS.length) {
      const tokens: string[] = (() => { try { return JSON.parse(process.env.FACEBOOK_ADS_TOKENS || "[]"); } catch { return []; } })();
      const accounts = ["act_1245711336722227","act_4026292580960461","act_1270507831043744"];
      tokens.forEach((t, i) => { if (t && accounts[i]) ADMINS.push({ name: `Admin${i+1}`, token: t, account: accounts[i] }); });
    }

    let synced = 0, errors = 0;
    for (const admin of ADMINS) {
      try {
        const url = `${FB}/${admin.account}/insights?level=ad&fields=ad_id,ad_name,spend,impressions,clicks,actions,action_values&date_preset=${date_preset}&time_increment=1&limit=500&access_token=${admin.token}`;
        const resp = await axios.get(url, { timeout: 30000 });
        const rows: any[] = resp.data?.data || [];

        for (const row of rows) {
          if (!row.ad_id || !row.date_start) continue;
          const date = new Date(row.date_start);
          date.setHours(0, 0, 0, 0);
          const spend = parseFloat(row.spend || "0");
          const impressions = parseInt(row.impressions || "0");
          const clicks = parseInt(row.clicks || "0");
          const getN = (arr: any[], t: string) => arr?.find((a: any) => a.action_type === t)?.value || 0;
          const metaConversions = Math.round(parseFloat(getN(row.actions, "purchase") || getN(row.actions, "onsite_conversion.messaging_first_reply") || "0"));

          await prisma.adPerformance.upsert({
            where: { adId_date: { adId: row.ad_id, date } },
            update: { adName: row.ad_name, spend, impressions, clicks, metaConversions },
            create: { adId: row.ad_id, adName: row.ad_name, date, spend, impressions, clicks, metaConversions },
          });
          synced++;
        }
        console.log(`[SYNC ADS] ${admin.name}: ${rows.length} registros`);
      } catch (e: any) {
        console.error(`[SYNC ADS] Error ${admin.name}:`, e.message);
        errors++;
      }
    }
    res.json({ success: true, synced, errors, admins: ADMINS.length });
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

  // PATCH /api/sales/:id/amount — actualizar monto de una venta y reintentar CAPI
  app.patch("/api/sales/:id/amount", async (req, res) => {
    try {
      const { id } = req.params;
      const { amount } = req.body;
      if (!amount || Number(amount) <= 0) return res.status(400).json({ error: "amount must be > 0" });

      const sale = await prisma.sale.update({
        where: { id },
        data: { amount: Number(amount), paymentStatus: "paid", capiStatus: "pending" }
      });
      // Re-run attribution with new amount
      await processAttribution(sale.id);
      const updated = await prisma.sale.findUnique({ where: { id } });
      if (updated?.isScalable) {
        sendToCapi(sale.id).catch(err => console.error(`[CAPI] retry failed:`, err));
      }
      res.json({ success: true, sale: updated });
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
      const { id, pixelId, accessToken, businessManagerId, datasetId, testEventCode, active, adminName, phoneNumber, inboxId, chatwootUrl } = req.body;

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
        inboxId: inboxId || null,
        chatwootUrl: chatwootUrl || null,
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

  // POST /api/admin/retry-duplicate-blocked — re-envía ventas duplicate_blocked que ahora tienen ctwaClid
  app.post("/api/admin/retry-duplicate-blocked", async (_req: express.Request, res: express.Response) => {
    try {
      const sales = await prisma.sale.findMany({
        where: { capiStatus: "duplicate_blocked", ctwaClid: { not: null }, isScalable: true },
        take: 100
      });
      res.json({ message: `Retrying ${sales.length} duplicate-blocked sales with ctwaClid` });
      for (const sale of sales) {
        // Reset capiStatus para que sendToCapi no lo saltee
        await prisma.sale.update({ where: { id: sale.id }, data: { capiStatus: "pending" } });
        await sendToCapi(sale.id).catch(() => {});
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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
    // Si la venta tiene ctwaClid, usar un event_id único que lo incluya
    // Esto permite re-enviar con más datos sin ser bloqueado como duplicado del envío anterior (sin ctwa_clid)
    const ctwaClid0 = sale.ctwaClid;
    const eventId = ctwaClid0
      ? `purchase_${sale.id}_${sale.phoneNormalized}_ctwa`
      : `purchase_${sale.id}_${sale.phoneNormalized}`;

    const existingEntry = await prisma.capiEvent.findUnique({ where: { eventId } });

    if (existingEntry && existingEntry.status === "sent") {
      await prisma.sale.update({ where: { id: sale.id }, data: { capiStatus: "duplicate_blocked" } });
      return;
    }

    // 1. Match by inboxId (sale.whatsappId = Chatwoot inbox_id enviado desde n8n)
    let config = sale.whatsappId
      ? sale.business.metaConfigs.find(c => c.active && c.inboxId && c.inboxId === sale.whatsappId)
      : undefined;
    // 2. Fallback: any active config
    if (!config) config = sale.business.metaConfigs.find(c => c.active);
    
    if (!config) return;

    try {
      // Obtener ctwaClid del sale (copiado del lead en processAttribution)
      // o directamente del lead matcheado si aún no estaba en el sale
      let ctwaClid = sale.ctwaClid;
      if (!ctwaClid) {
        const match = await prisma.attributionMatch.findFirst({
          where: { saleId: sale.id },
          include: { lead: { select: { ctwaClid: true } } }
        });
        ctwaClid = match?.lead?.ctwaClid || null;
      }

      const phoneHash = crypto.createHash('sha256').update(sale.phoneNormalized).digest('hex');
      const userData: any = { ph: [phoneHash] };
      if (ctwaClid) {
        userData.ctwa_clid = ctwaClid;
      }

      const payload = {
        data: [{
          event_name: "Purchase",
          event_time: Math.floor(sale.createdAt.getTime() / 1000),
          action_source: "chat",
          event_id: eventId,
          user_data: userData,
          custom_data: {
            value: sale.amount > 0 ? sale.amount : 1,
            currency: sale.currency || "CLP",
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

  // GET /api/attribution — Matches de atribución con datos completos
  app.get("/api/attribution", async (req, res) => {
    try {
      const { from, to, limit: lim } = req.query;
      const take = Math.min(parseInt(String(lim || "100")), 500);
      const where: any = {};
      if (from) where.createdAt = { gte: parseDateParam(from) };
      if (to) where.createdAt = { ...where.createdAt, lte: parseDateParam(to, true) };

      const matches = await prisma.attributionMatch.findMany({
        where,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          sale: { select: { id:true, customerName:true, phone:true, amount:true, currency:true, capiStatus:true, attributionStatus:true, isScalable:true, createdAt:true, adName:true, campaignName:true } },
          lead: { select: { id:true, customerName:true, phone:true, ctwaClid:true, adId:true, adName:true, campaignName:true, adsetName:true, createdAt:true } }
        }
      });
      res.json(matches);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/capi/events — Log de todos los eventos CAPI enviados
  app.get("/api/capi/events", async (req, res) => {
    try {
      const { from, to, status, limit: lim } = req.query;
      const take = Math.min(parseInt(String(lim || "100")), 500);
      const where: any = {};
      if (status) where.status = String(status);
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = parseDateParam(from);
        if (to) where.createdAt.lte = parseDateParam(to, true);
      }

      const events = await prisma.capiEvent.findMany({
        where, take,
        orderBy: { createdAt: "desc" },
        include: {
          sale: { select: { customerName:true, phone:true, amount:true, currency:true, campaignName:true, adName:true } }
        }
      });
      res.json(events);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/leads
  app.get("/api/leads", async (req, res) => {
    try {
      const { from, to } = req.query;
      let where: any = {};
      
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = parseDateParam(from);
        if (to) {
          where.createdAt.lte = parseDateParam(to, true);
        }
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        where.createdAt = { gte: today };
      }

      const leads = await prisma.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          matches: {
            include: {
              sale: {
                select: {
                  id: true,
                  amount: true,
                  capiStatus: true,
                  attributionStatus: true,
                  metaStatus: true,
                  metaError: true,
                  metaResponse: true,
                  fechaEnvioMeta: true,
                  createdAt: true,
                }
              }
            },
            orderBy: { createdAt: "desc" },
            take: 1
          }
        }
      });

      // Aplanar: adjuntar datos de la venta atribuida directamente al lead
      const enriched = leads.map(lead => {
        const bestMatch = lead.matches?.[0];
        const sale = bestMatch?.sale;
        return {
          ...lead,
          matches: undefined,
          // Datos de la venta atribuida (para el inspector)
          saleId:             sale?.id || null,
          saleAmount:         sale?.amount || null,
          capiStatus:         sale?.capiStatus || null,
          saleFechaEnvioMeta: sale?.fechaEnvioMeta || null,
          saleMetaStatus:     sale?.metaStatus || null,
          saleMetaError:      sale?.metaError || null,
          saleMetaResponse:   sale?.metaResponse || null,
          saleAttributionStatus: sale?.attributionStatus || null,
        };
      });

      res.json(enriched);
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
        if (from) where.createdAt.gte = parseDateParam(from);
        if (to) {
          where.createdAt.lte = parseDateParam(to, true);
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
    
    // Iniciar sincronización automática cada 2 minutos
    console.log("[SYNC] Programando sincronización automática cada 2 minutos");
    setInterval(async () => {
      try {
        const result = await syncGoogleSheets();
        if (result.success && result.ids) {
          for (const id of result.ids) {
            await processAttribution(id);
            notifyTelegram(id).catch(() => {});
          }
        }
      } catch (err) {
        console.error("[SYNC ERROR]", err);
      }
    }, 2 * 60 * 1000);

    // Iniciar reintento automático de CAPI cada 5 minutos
    console.log("[CAPI] Programando reintento automático cada 5 minutos");
    setInterval(() => {
      runCapiRetryJob().catch(err => console.error("[CAPI RETRY ERROR]", err));
    }, 5 * 60 * 1000);

    // Primera sincronización al arrancar
    syncGoogleSheets().then(async (result) => {
      if (result.success && result.ids) {
        for (const id of result.ids) {
          await processAttribution(id);
          notifyTelegram(id).catch(() => {});
        }
      }
    }).catch(err => console.error("[SYNC START ERROR]", err));
  });

  async function runCapiRetryJob() {
    const failedSales = await prisma.sale.findMany({
      where: {
        capiStatus: "failed",
        isScalable: true,
        intentosReintento: { lt: 5 }
      },
      take: 20
    });

    if (failedSales.length === 0) return;
    console.log(`[CAPI RETRY] Intentando re-enviar ${failedSales.length} ventas...`);

    for (const sale of failedSales) {
      await prisma.sale.update({
        where: { id: sale.id },
        data: { intentosReintento: { increment: 1 } }
      });
      await sendToCapi(sale.id).catch(err => console.error(`[CAPI RETRY] Falló para ${sale.id}:`, err));
    }
  }

  async function notifyTelegram(saleId: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    try {
      const sale = await prisma.sale.findUnique({ where: { id: saleId } });
      if (!sale) return;

      const message = `🚀 *NUEVA VENTA DETECTADA*\n\n` +
                      `👤 *Cliente:* ${sale.customerName || 'Desconocido'}\n` +
                      `💰 *Monto:* $${new Intl.NumberFormat('es-CL').format(sale.amount)} ${sale.currency}\n` +
                      `📱 *Teléfono:* ${sale.phone}\n` +
                      `🏷️ *Campaña:* ${sale.campaignName || 'Orgánico'}\n` +
                      `🔗 *Ad:* ${sale.adName || 'N/A'}\n` +
                      `📡 *Status CAPI:* ${sale.capiStatus}\n\n` +
                      `_Enviado desde CapiCenter Orbital_`;

      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      });
      console.log(`[NOTIFY] Telegram enviado para venta ${saleId}`);
    } catch (e: any) {
      console.error("[NOTIFY ERROR] Telegram:", e.message);
    }
  }
}


startServer();
