# Spec seed — A-S3: Productos por WhatsApp (Atlas ejecuta)

> Estado: DRAFT para aprobación · Fecha: 2026-07-02
> Contexto: Felipe — "además de informar, que Atlas pueda ejecutar: mando foto, nombre, precio e inventario y monta el producto; y así todo lo operable por WhatsApp".
> Principio Hermes (ATLAS_VALUE_FIRST_PLAN §4): el agente PROPONE, el merchant APRUEBA, el executor EJECUTA con whitelist. Nunca mutación directa desde texto libre.

## 1. UX objetivo

```
Merchant → [foto] "Camiseta oversize roja, 50mil, 10 unidades, talla S a XL"
Atlas    → "📦 ¿Creo este producto?
            • Camiseta oversize roja
            • Precio: $50.000 · Stock: 10
            • Variantes: S, M, L, XL
            • Foto: ✓ recibida
            Responde 1 para crearlo, 'no' para descartar."
Merchant → "1"
Atlas    → "✅ Creado y publicado: landingchat.co/store/tez/producto/camiseta-oversize-roja
            Puedes editarlo en tu dashboard."
```

## 2. Arquitectura (reusa el loop existente al 100%)

1. **Webhook** (`platform-inbound.ts`): hoy solo procesa `type=text`. Extender: `type=image` → guardar media pendiente + si trae caption, procesarla como texto con contexto "media adjunta".
2. **Media pipeline** (nuevo `src/lib/copilot/whatsapp-media.ts`):
   - Meta Cloud API: `GET /{media-id}` → URL efímera → download con Bearer token (5 min de vida).
   - Upload a Supabase Storage (bucket de productos del org) → path permanente.
   - Límites: solo `image/jpeg|png|webp`, máx ~5MB, 1-N imágenes por propuesta.
3. **Tool nueva del agente** (`merchant-agent.ts`): `propose_product` — el LLM extrae `{ name, price, stock, variants?, description? }` del caption/mensaje; la tool crea un **insight** `scope=on_demand` con `proposed_actions: [{ type: "create_product", params: { ...datos, image_paths } }]` y responde con el resumen numerado.
4. **Whitelist + executor** (`actionExecutor.ts`): nuevo action type `create_product` → crea el producto (draft→active) con imágenes desde Storage, slug único, organization_id del insight. Validación Zod de params (precio > 0, stock >= 0, nombre 3-120 chars).
5. **Aprobación**: el "1" del merchant viaja por `whatsappReplyHandler` SIN CAMBIOS (ya ejecuta proposed_actions por índice).

## 3. Seguridad / edge cases

- Identidad: mismo `matchMerchantByPhone` (desconocidos = silencio). Media de desconocidos: se ignora, no se descarga.
- Media sin caption: Atlas pide los datos ("recibí la foto 👌 dime nombre, precio y stock").
- Caption ambigua (sin precio): Atlas pregunta en vez de inventar.
- Dedupe: por `messageId` (ya existe). Media duplicada por reintento de webhook → mismo idempotency key.
- Rate limit: mismo contador diario (30/día) + máx N propuestas de producto/día (definir, sugerido 10).
- Storage: validar mime real (magic bytes), nombre aleatorio (nunca el filename del usuario).
- El producto nace `active` tras aprobación explícita (decisión: ¿o draft? → PREGUNTA ABIERTA para Felipe).

## 4. Slices

| Slice | Entrega | Est. |
|---|---|---|
| T1 | Media pipeline + test (download→storage, validaciones) | 0.5-1d |
| T2 | `create_product` en whitelist + executor + Zod + tests | 0.5d |
| T3 | Tool `propose_product` en merchant-agent + manejo de `type=image` en inbound + tests | 1d |
| T4 | Smoke real (foto desde WhatsApp de Felipe → producto en tienda) + doc | 0.5d |

## 5. Extensión natural post-S3 (mismo patrón, un action type cada una)

`update_price` · `update_stock` · `create_coupon` · `update_product_photo` · `create_collection` (cuando exista la entidad — ver GAP_JAMAR) · `set_delivery_estimate`. Cada una: params Zod + executor + entrada whitelist. Atlas las propone, el merchant aprueba con "1".
