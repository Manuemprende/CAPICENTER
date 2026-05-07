# CAPICENTER

Plataforma para recibir leads/ventas desde n8n, atribuir contra leads de WhatsApp, proteger contra duplicados y enviar eventos CAPI a Meta cuando la venta sea escalable.

## Endpoints n8n

Usa un solo nodo HTTP Request en n8n:

```text
POST https://TU_DOMINIO/api/webhooks/n8n
x-api-key: TU_API_KEY
Content-Type: application/json
```

Payload minimo para venta:

```json
{
  "event": "conversation_updated",
  "labels": ["pagado"],
  "phone": "+56912345678",
  "amount": 39990,
  "externalId": "chatwoot-123",
  "name": "Cliente",
  "country": "CL",
  "adId": "120000000",
  "adName": "Anuncio",
  "adHeadline": "Titulo del anuncio",
  "adUrl": "https://facebook.com/ads/...",
  "ctwaClid": "clid...",
  "metaEventId": "purchase-chatwoot-123",
  "currency": "CLP"
}
```

Si el payload no trae etiqueta de venta (`pagado`, `pagada`, `paid`, `compra`, `comprado`, `convertido`, `venta`) o `type/eventType= sale|venta`, se registra como lead.

Endpoints tipados disponibles:

```text
POST /api/webhooks/leads
POST /api/webhooks/sales
POST /api/webhooks/n8n
```

## Protecciones

- API key obligatoria mediante `x-api-key`.
- Deduplicacion por `businessId + metaEventId`.
- Deduplicacion de ventas por `businessId + externalId`.
- Circuit breaker: maximo 3 leads o 3 ventas por telefono en 15 minutos.
- CAPI automatico cuando la venta queda atribuida y marcada como escalable.

## Local

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

API key inicial del seed:

```text
test_key_123456
```

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

El contenedor ejecuta `prisma db push` al arrancar y persiste SQLite en el volumen `capicenter_data`.
