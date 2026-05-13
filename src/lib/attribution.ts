import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import crypto from 'crypto';

const prisma = new PrismaClient();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "fallback_key_32_chars_long_12345";

function decrypt(text: string) {
  try {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift()!, "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch { return ""; }
}

export async function enrichLeadAdData(leadId: string, adId: string) {
  try {
    const configs = await prisma.metaConfig.findMany({ where: { active: true } });
    const tokens = configs.map(c => decrypt(c.accessToken)).filter(Boolean);

    for (const token of tokens) {
      try {
        const { data } = await axios.get(
          `https://graph.facebook.com/v19.0/${adId}?fields=name,campaign{name,id},adset{name,id}&access_token=${token}`,
          { timeout: 8000 }
        );
        if (!data?.campaign?.name) continue;

        const updatedLead = await prisma.lead.update({
          where: { id: leadId },
          data: {
            adName: data.name,
            campaignId: data.campaign?.id,
            campaignName: data.campaign?.name,
            adsetId: data.adset?.id,
            adsetName: data.adset?.name,
          },
        });
        
        // Update all sales that belong to this lead/phone number
        const pendingSales = await prisma.sale.findMany({
          where: { businessId: updatedLead.businessId, phoneNormalized: updatedLead.phoneNormalized }
        });
        for (const s of pendingSales) {
          await processAttribution(s.id).catch(() => {});
        }
        
        console.log(`[ENRICH] Lead ${leadId} enriched and sales updated with campaign: ${data.campaign?.name}`);
        return;
      } catch { continue; }
    }
  } catch (err: any) {
    console.error(`[ENRICH ERROR] Lead ${leadId}:`, err.message);
  }
}

export async function processAttribution(saleId: string) {
  const sale = await prisma.sale.findUnique({ where: { id: saleId } });
  if (!sale) return { success: false };

  console.log(`[ATTRIBUTION] Procesando venta ${sale.id} (${sale.phoneNormalized})`);

  let bestLeadId: string | null = null;
  let bestScore = 0;
  let matchType = "";

  if (sale.ctwaClid) {
    const clidLead = await prisma.lead.findFirst({
      where: { businessId: sale.businessId, ctwaClid: sale.ctwaClid },
      orderBy: { createdAt: 'desc' }
    });
    if (clidLead) {
      bestLeadId = clidLead.id;
      bestScore = 100;
      matchType = "ctwa_clid";
    }
  }

  if (bestScore < 100) {
    const leads = await prisma.lead.findMany({
      where: {
        businessId: sale.businessId,
        OR: [
          { phoneNormalized: sale.phoneNormalized },
          { whatsappId: sale.whatsappId ? sale.whatsappId : undefined }
        ].filter(c => c.phoneNormalized !== undefined || c.whatsappId !== undefined) as any
      },
      orderBy: { createdAt: 'desc' },
      take: 20
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

      if (lead.campaignId || lead.adId) {
        score += 5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestLeadId = lead.id;
        matchType = type;
      }
    }

    // Last resort: Name match if score is still 0
    if (bestScore === 0 && sale.customerName) {
       const nameLeads = await prisma.lead.findMany({
         where: { 
           businessId: sale.businessId, 
           customerName: { contains: sale.customerName.split(' ')[0], mode: 'insensitive' } 
         },
         orderBy: { createdAt: 'desc' },
         take: 5
       });
       for (const lead of nameLeads) {
         if (lead.customerName && lead.customerName.toLowerCase().includes(sale.customerName.toLowerCase().split(' ')[0])) {
           const diff = Math.abs(sale.createdAt.getTime() - lead.createdAt.getTime());
           if (diff < 48 * 60 * 60 * 1000) {
             bestScore = 60;
             bestLeadId = lead.id;
             matchType = "name_fuzzy";
             break;
           }
         }
       }
    }
  }

  if (bestLeadId && bestScore >= 60) {
    const lead = await prisma.lead.findUnique({ where: { id: bestLeadId } });
    if (lead) {
      const status = bestScore >= 95 ? 'strong_match' : 'attributed';
      const isScalable = (sale.paymentStatus === 'paid' && (lead.adId || lead.campaignId));

      await prisma.sale.update({
        where: { id: sale.id },
        data: {
          attributionStatus: status,
          isScalable: !!isScalable,
          adId: lead.adId || sale.adId,
          adName: lead.adName || sale.adName,
          adHeadline: lead.adHeadline || sale.adHeadline,
          adsetId: lead.adsetId || sale.adsetId,
          adsetName: lead.adsetName || sale.adsetName,
          campaignId: lead.campaignId || sale.campaignId,
          campaignName: lead.campaignName || sale.campaignName,
          ctwaClid: lead.ctwaClid || sale.ctwaClid,
          country: lead.country || sale.country,
          customerName: lead.customerName || sale.customerName,
        }
      });

      const existingMatch = await prisma.attributionMatch.findFirst({
        where: { saleId: sale.id }
      });

      if (existingMatch) {
        await prisma.attributionMatch.update({
          where: { id: existingMatch.id },
          data: {
            leadId: lead.id,
            matchScore: bestScore,
            matchType: matchType
          }
        });
      } else {
        await prisma.attributionMatch.create({
          data: {
            saleId: sale.id,
            leadId: lead.id,
            matchScore: bestScore,
            matchType: matchType
          }
        });
      }

      console.log(`[ATTRIBUTION OK] Sale ${sale.id} matched with Lead ${lead.id} (Score: ${bestScore}, Scalable: ${isScalable})`);
      return { success: true, isScalable, leadId: lead.id };
    }
  } else {
    await prisma.sale.update({
      where: { id: sale.id },
      data: { attributionStatus: 'manual_review' }
    });
  }
  return { success: false };
}
