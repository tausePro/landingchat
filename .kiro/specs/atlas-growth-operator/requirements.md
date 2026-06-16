# Atlas Growth Operator — Requirements (roadmap / refinamiento)

> **Estado**: En refinamiento estratégico (no aprobado para construir aún). Cada frente saca su `design.md` + `tasks.md` cuando se elige construirlo.
> **Origen**: conversación de roadmap 2026-06-15 (@tause + Devin).
> **Tesis**: evolucionar Atlas de "copiloto que reporta" a **operador de crecimiento** que lee, estrategiza, crea, publica/envía, mide y aprende — siempre con aprobación del merchant (modelo Hermes).
> **Doc relacionado**: `.kiro/specs/copilot-merchant-loop-v0/` (la base ya en prod).

---

## 1. La tesis (qué es Atlas Growth Operator)

Hoy Atlas reporta semanalmente y ejecuta acciones internas aprobadas (cupón, pausar producto). El norte es que Atlas opere el **embudo completo de crecimiento**, autónomo y con aprobación:

```
LEE (analítica + social + ads + chats)
  → ESTRATEGIZA (el merchant conversa con él)
    → CREA (copy con Claude + imagen con Recraft)
      → PUBLICA / ENVÍA (feeds Meta + capa de entrega unificada WhatsApp/email)
        → MIDE (atribución por canal, ya existente)
          → APRENDE (dobla la apuesta en lo que funciona)
```

Tráfico entra → storefront convierte → agente cierra → outbound recupera → Atlas orquesta y aprende. **No son features sueltas; es un solo sistema.**

Principio rector (adoptado de ponytail, ver `AGENTS.md` §YAGNI): el mínimo que funcione bien, sin recortar validación/seguridad/consentimiento. Reusar lo que ya existe antes de construir.

---

## 2. Inventario: qué YA tenemos (no reconstruir)

| Capacidad | Estado | Dónde |
|---|---|---|
| Agente IA en **WhatsApp** (WABA + Evolution) | ✅ | `src/lib/whatsapp/`, `src/lib/ai/` |
| Agente en **Instagram DM + Messenger** | ✅ | `src/lib/messaging/meta-social-client.ts` |
| **Copilot** semanal (insights + acciones + reply "1/2/3" por WhatsApp + vertical-aware) | ✅ | `src/lib/copilot/`, `src/app/api/cron/copilot/` |
| Páginas FB + cuentas IG Business conectadas (**page tokens guardados**) | ✅ | `src/app/api/auth/social-channels/callback/` |
| Leer **Meta Ads** + **CAPI** + **atribución de venta por canal** | ✅ | `src/lib/analytics/meta-marketing-api.ts`, `meta-conversions-api.ts` |
| Email transaccional (**Resend**) | ✅ | `src/lib/notifications/email.ts` |
| Onboarding mágico (importa catálogo + marca + fotos desde la web) | ✅ | `src/lib/onboarding/store-importer.ts` |
| SEO/AEO/GEO infra: `sitemap.ts`, `robots.txt`, **`llms.txt`**, JSON-LD (producto/org/landing/catálogo), campos SEO | ✅ | `src/app/sitemap.ts`, `src/app/llms.txt/`, `src/components/seo/`, `src/lib/seo/` |
| Analítica propia (`analytics_events`) + PostHog | ✅ | `src/lib/analytics/` |

**Conclusión**: el cimiento está sorprendentemente completo. La mayoría de frentes son **aditivos**, no integraciones desde cero.

---

## 3. Frentes (cada uno → su design.md cuando se apruebe)

### F1. Medir la fricción (funnel) — *barato, define todo*
Antes de optimizar, medir. Reporte de embudo visita → producto → chat → carrito → pago con `analytics_events` + PostHog: ¿dónde se caen? Hipótesis: en comercio conversacional la conversión real es meter al visitante al chat rápido (la conversación personaliza, no la página).

### F2. Atlas conversacional (la keystone)
El merchant **conversa** con Atlas ("¿cómo vendo más?", "arma promo del día de la madre", "¿qué producto empujo?") y Atlas co-crea y ejecuta con sus datos. Nueva superficie de chat (dashboard y/o WhatsApp) con tools sobre métricas + whitelist de acciones. Es el **cerebro** del que cuelgan los demás frentes.

### F3. Outbound que recupera ventas (+ Recraft)
`send_coupon_to_customers` hoy crea el cupón; el salto es que **escriba a los clientes** (carritos abandonados / inactivos — ya detectados en `weeklyMetrics`) con copy + imagen (Recraft) y mida la **plata recuperada**. Guardrail: consentimiento (solo relación previa), rate-limit, ventana 24h Meta / templates.

### F4. Storefront generado por merchant (extiende onboarding)
Tras importar catálogo+marca, Atlas **genera el storefront** (layout, copy, secciones, hero) a medida del vertical y la marca — no plantilla genérica. Per-VISITANTE queda fuera (prematuro para el tráfico de un SMB).

### F5. Capa de entrega unificada (inspirada en sent.dm)
`sendToContact({ contact, mensaje, canales })`: intenta **WhatsApp** → fallback **email** (Resend), respeta **consentimiento por canal**, **template único** que renderiza por canal. Es el **backbone** del outbound y las campañas. **SMS/RCS NO** ahora (WhatsApp domina LATAM); si algún día importa SMS, adoptar sent.dm/Twilio como pata detrás de esta capa.

### F6. Meta: publicar + leer + optimizar ads
- **Publicar al feed** FB/IG (aditivo: ya tenemos tokens + IG Business; faltan scopes `instagram_content_publish`/`pages_manage_posts` + Content Publishing API).
- **Leer orgánico** (comentarios/menciones/insights por webhooks Graph) → alimenta el aprendizaje.
- **Optimizar ads** (ya leemos campañas): Atlas recomienda mover presupuesto a lo que convierte — palanca de tráfico más confiable que el orgánico.

### F7. Discoverability — SEO / AEO / GEO (auto-generado por Atlas)
Los tubos existen; el contenido suele estar vacío. Atlas auto-genera (con aprobación, calidad > cantidad):

- **SEO**: `seo_title`/`seo_description` por tienda y producto, descripciones de producto ricas (el catálogo importado viene flaco), **alt text** de imágenes, descripciones de categoría, headings, interlinking.
- **AEO** (ChatGPT/Perplexity/AI Overviews): **FAQ en Q&A** + `FAQPage` JSON-LD, respuestas factuales (envíos/devoluciones/tallas/pagos), **`llms.txt` enriquecido** (qué vende, productos clave, políticas).
- **GEO** (respuestas generativas): claridad de **entidad** (JSON-LD ya existe), contenido **citable** (guías de compra, comparativas), señales de frescura.
- **🔑 Moat único — los chats**: Atlas mina las conversaciones reales → FAQ/AEO en las palabras exactas de los clientes (long-tail real), prioriza SEO por lo más preguntado. *El comercio conversacional alimenta la descubribilidad: el agente vuelve descubrible la tienda.*
- **Guardrail**: contenido específico y aterrizado en datos reales (catálogo + chats), nunca páginas thin de IA (penaliza helpful-content de Google).

---

## 4. Secuencia recomendada

1. **F1 Medir fricción** (barato; define prioridades reales en vez de adivinar).
2. **F2 Atlas conversacional** (la keystone; reusa casi todo; cerebro de lo demás).
3. **F3 Outbound + Recraft** (recupera ventas medibles; necesita F5 como base de envío).
4. **F7 Discoverability SEO/AEO/GEO** (motor de tráfico orgánico, durable y barato; alto reuso del moat de chats).
5. **F6 Meta publishing + ads optimization** (tráfico activo).
6. **F4 AI storefront** (la superficie que convierte).

(F5 capa unificada se construye como dependencia justo antes de F3.)

---

## 5. Guardrails transversales (lazy, not negligent)

- **Aprobación del merchant** en todo lo que sale a clientes o al público (mismo patrón "1/2/3" del copilot).
- **Consentimiento + anti-spam** por canal; ventana 24h Meta / templates aprobados.
- **Calidad sobre cantidad** en contenido auto-generado (anti thin-content).
- **Seguridad de marca**: nada se publica sin que el merchant lo vea.

## 6. Fuera de alcance (por ahora)
- Personalización de storefront **por visitante** (prematuro para el tráfico SMB).
- **SMS / RCS** (WhatsApp domina LATAM; adoptar sent.dm/Twilio solo si un cliente real lo pide).
- **Canva** Connect API (handoff de edición; Recraft cubre la generación automática primero).
