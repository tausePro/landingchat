# LandingChat — AI Marketing Engine

> Visión estratégica: Todo lo que podemos construir con la conexión Meta + datos internos + agente AI
> Fecha: 2026-02-25
> Estado: Documento de visión / Roadmap técnico

---

## Lo que tenemos HOY

### Permisos Meta (22 scopes activos)
| Categoría | Permisos | Qué permite |
|-----------|----------|-------------|
| **Ads** | `ads_read`, `ads_management` | Leer Y crear campañas |
| **Pixel/CAPI** | `pages_manage_metadata`, `business_management` | Tracking server-side |
| **WhatsApp** | `whatsapp_business_messaging`, `whatsapp_business_management`, `whatsapp_business_manage_events`, `paid_marketing_messages` | Mensajería + marketing masivo |
| **Instagram** | `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `instagram_manage_insights`, `instagram_content_publish`, `instagram_shopping_tag_products`, `instagram_branded_content_*` | DMs, publicar, shopping, insights |
| **Facebook** | `pages_messaging`, `pages_read_engagement`, `pages_manage_ads` | Messenger, insights, ads |
| **Catálogos** | `catalog_management` | Sync productos con Meta Commerce |
| **Leads** | `leads_retrieval` | Capturar leads de formularios |
| **Threads** | `threads_business_basic` | Presencia en Threads |

### Datos internos
- **Clientes**: nombre, teléfono, email, historial de compras, canal de origen
- **Conversaciones**: web chat + WhatsApp, todos los mensajes, herramientas usadas por la IA
- **Órdenes**: productos, montos, fechas, estado de pago, canal de origen, UTM data
- **Productos**: catálogo completo con precios, stock, categorías, imágenes
- **Navegación**: PostHog (session recording, eventos), Meta Pixel (ViewContent, AddToCart, Purchase)
- **Atribución**: UTM tracking → qué campaña generó qué venta

### Infraestructura AI
- Claude como agente conversacional con 17 herramientas de e-commerce
- Context builder que inyecta catálogo + historial del cliente
- Ejecución de herramientas en tiempo real (carrito, checkout, búsqueda)

---

## 🧠 NIVEL 1 — Agente de Analytics Interno

**Concepto**: Un agente AI que analiza todos los datos y actúa como un CMO virtual.

### 1.1 Briefing Diario Automático
El agente genera cada mañana un resumen para el dueño del negocio:

```
Buenos días. Aquí tu resumen de ayer:

📊 Ventas: 3 órdenes por $450.000 (↑ 50% vs. día anterior)
💬 Conversaciones: 12 chats, 3 convirtieron (25% conversión)
📱 WhatsApp: 8 mensajes entrantes, 2 ventas cerradas
📈 Meta Ads: Campaña "Navidad" gastó $15.000, generó 2 ventas (ROAS 3.2x)
⚠️ Alerta: El producto "Crema Facial" tiene solo 3 unidades en stock
💡 Recomendación: Subir presupuesto de campaña "Navidad" de $50K a $80K, el ROAS justifica la inversión
```

**Implementación**: Edge Function con cron job → consulta Supabase + Meta API → genera resumen con Claude → envía por WhatsApp al dueño.

### 1.2 Detección de Anomalías
- CTR de campaña cayó más del 30% → alerta inmediata
- Producto con muchas vistas pero 0 compras → posible problema de precio
- Pico inusual de conversaciones → posible viralización, preparar stock
- Tasa de abandono de carrito subió → revisar checkout

### 1.3 Análisis de Conversaciones (NLP)
- **Objeciones más comunes**: "Es muy caro", "No hacen envíos a mi ciudad", "¿Tienen en otro color?"
- **Productos más preguntados** vs. más vendidos (gap = oportunidad)
- **Sentimiento por producto**: análisis de sentimiento de las conversaciones
- **Preguntas sin respuesta**: qué no sabe responder el agente → mejorar catálogo/prompts

### 1.4 Customer Scoring Predictivo
Con los datos de chats + compras + navegación, el agente asigna un score a cada cliente:

| Score | Significado | Acción automática |
|-------|-------------|-------------------|
| 🔥 90-100 | Va a comprar pronto | Priorizar, ofrecer descuento exclusivo |
| 🟡 60-89 | Interesado pero indeciso | Seguimiento por WhatsApp |
| 🔵 30-59 | Explorador | Retargeting con Meta Ads |
| ⚪ 0-29 | Frío | Incluir en audiencia de nurturing |

---

## 📣 NIVEL 2 — Motor de Marketing Automatizado

### 2.1 Creación Automática de Campañas (`ads_management`)
El agente puede CREAR campañas en Meta Ads:

**Flujo**: Dueño sube producto nuevo → El agente automáticamente:
1. Genera copy publicitario (Claude) basado en descripción del producto
2. Sugiere audiencia basada en compradores similares
3. Crea campaña en Meta con presupuesto sugerido
4. Monitorea ROAS y ajusta

**Tipos de campaña automática**:
- **Lanzamiento de producto**: Nuevo producto → campaña de awareness
- **Liquidación**: Stock bajo + ventas lentas → campaña de descuento
- **Temporada**: Detecta fechas comerciales → campaña temática
- **Lookalike**: Toma mejores clientes → crea Lookalike → campaña

### 2.2 Audiencias Inteligentes (Custom Audiences + Lookalikes)
Con `ads_management` podemos subir listas de clientes a Meta:

| Audiencia | Fuente | Uso |
|-----------|--------|-----|
| Compradores recientes | orders (last 30d) | Excluir de prospección, upsell |
| Compradores VIP | orders (LTV > X) | Lookalike para encontrar más como ellos |
| Abandonaron carrito | carts sin order | Retargeting directo |
| Chatearon sin comprar | chats sin order | Retargeting con descuento |
| Visitaron producto X | Pixel ViewContent | Retargeting dinámico |
| Clientes inactivos | orders (>60d sin compra) | Win-back campaign |

**Sync automático**: Cron que actualiza audiencias cada noche.

### 2.3 Retargeting Inteligente
No es solo "mostrar el mismo producto". El agente decide QUÉ mostrar:

- Vio producto A pero no compró → mostrar producto A con descuento
- Compró producto A → mostrar producto B complementario
- Abandonó carrito → mostrar los productos del carrito + urgencia ("quedan 2 unidades")
- Chateó sobre envíos → mostrar ad con "Envío gratis este fin de semana"

### 2.4 Dynamic Product Ads (DPA) desde Catálogo
Con `catalog_management`:
1. Sync automático de productos → Meta Commerce Catalog
2. Meta genera ads dinámicos con los productos correctos para cada persona
3. Actualización automática de precios/stock
4. Instagram Shopping tags automáticos

---

## 📱 NIVEL 3 — WhatsApp Marketing Engine

### 3.1 Mensajes de Marketing Pagados (`paid_marketing_messages`)
Meta permite enviar mensajes promocionales a clientes que optaron in:

- **Flash sales**: "Solo hoy: 30% en toda la línea facial 🔥"
- **Nuevos productos**: "Acaba de llegar X, ¿te interesa?"
- **Restock alerts**: "El producto que querías ya está disponible"
- **Eventos**: "Este sábado taller de skincare, ¿te reservo cupo?"

### 3.2 Recuperación de Carrito por WhatsApp
```
Hola María 👋

Vi que dejaste estos productos en tu carrito:
🧴 Crema Hidratante - $89.000
🌿 Sérum Vitamina C - $120.000

¿Te gustaría completar tu compra? Te puedo ayudar con el pago aquí mismo.

[Completar compra] [Tengo una pregunta]
```

**Flujo**: Cart abandonado (30min) → WhatsApp template → Si responde, el agente AI retoma la conversación.

### 3.3 Post-Compra Automatizado
1. **Confirmación**: "Tu pedido #123 fue confirmado ✅"
2. **Envío**: "Tu pedido va en camino 🚚 Tracking: XXX"
3. **Entrega**: "¿Recibiste tu pedido? ¿Todo bien?"
4. **Review** (7 días): "¿Qué te pareció la Crema Hidratante? Tu opinión nos importa"
5. **Recompra** (30 días): "¿Necesitas reabastecer? Te doy 10% en tu próxima compra"

### 3.4 Segmentación + Personalización
El agente no envía lo mismo a todos. Usa el customer score + historial:
- Cliente VIP → acceso anticipado + descuento exclusivo
- Cliente nuevo → educación sobre la marca + bienvenida
- Cliente inactivo → "Te extrañamos" + oferta irresistible

---

## 📸 NIVEL 4 — Instagram Commerce Automation

### 4.1 Auto-Publicación de Productos (`instagram_content_publish`)
Nuevo producto en catálogo → El agente:
1. Selecciona las mejores fotos del producto
2. Genera caption con Claude (tono de la marca)
3. Publica en Instagram con shopping tags
4. Programa stories de soporte

### 4.2 Comment Auto-Response (`instagram_manage_comments`)
Alguien comenta "¿Precio?" en un post → El agente:
1. Responde: "¡Hola! Este producto está a $89.000. Te escribo por DM con más info 😊"
2. Envía DM con detalles del producto + link de compra
3. Si el usuario responde, continúa la conversación como agente de ventas

### 4.3 Instagram DM Commerce (`instagram_manage_messages`)
Mismo agente AI que maneja web chat y WhatsApp, ahora en Instagram DMs:
- Contexto unificado: sabe qué vio en la tienda web
- Puede buscar productos, agregar al carrito, iniciar checkout
- Envía links de pago directamente en el DM

### 4.4 Shopping Tags Automáticos (`instagram_shopping_tag_products`)
Cada post con productos → auto-tagged con el catálogo de Meta Commerce
- Precios siempre actualizados
- Stock reflejado en tiempo real
- Click → directo a la tienda

### 4.5 Insights de Contenido (`instagram_manage_insights`)
- ¿Qué tipo de contenido genera más ventas?
- ¿Qué horarios tienen mejor engagement?
- ¿Qué hashtags funcionan?
- El agente recomienda estrategia de contenido basada en datos

---

## 🎯 NIVEL 5 — Lead Generation Engine

### 5.1 Facebook/Instagram Lead Forms (`leads_retrieval`)
1. Crear campaña de leads en Meta (automático)
2. Usuario llena formulario en Facebook/Instagram
3. Webhook captura el lead instantáneamente
4. El agente AI contacta por WhatsApp en < 5 minutos
5. Califica el lead a través de conversación
6. Si es caliente → agenda cita / envía catálogo / cierra venta
7. Si es tibio → nurturing automático

**Dato**: Los leads contactados en < 5 min tienen 21x más probabilidad de convertir.

### 5.2 Chatbot como Lead Qualifier
En vez de solo capturar nombre/email, el chat pre-califica:
- ¿Qué producto te interesa?
- ¿Para cuándo lo necesitas?
- ¿Cuál es tu presupuesto?
- El agente asigna score y prioriza

---

## 🔄 NIVEL 6 — Flujos Cross-Channel Automatizados

### 6.1 El Viaje del Cliente Orquestado por IA

```
[Meta Ad] → [Click] → [Landing/Tienda] → [Pixel: ViewContent]
    ↓
[Chat Widget aparece] → "¡Hola! Vi que estás viendo la Crema Hidratante. ¿Puedo ayudarte?"
    ↓
[Conversación] → Identifica cliente → [WhatsApp vinculado]
    ↓
[Agrega al carrito] → [Pixel: AddToCart]
    ↓
[No compra] → [30 min después: WhatsApp] → "Hey, dejaste algo en el carrito 😊"
    ↓
[No responde] → [24h después: Retarget Ad en Instagram]
    ↓
[Compra] → [CAPI: Purchase] → [Meta optimiza para más conversiones como esta]
    ↓
[Post-compra] → [WhatsApp: confirmación] → [7d: review] → [30d: recompra]
    ↓
[Cliente VIP] → [Custom Audience] → [Lookalike] → [Encontrar más clientes similares]
```

### 6.2 Attribution Completa
Cada venta tiene la historia completa:
- Qué campaña la originó (UTM)
- Qué productos vio antes (Pixel)
- Qué conversación tuvo (chat logs)
- Por qué canal compró (web/WhatsApp/Instagram)
- Cuánto costó adquirir ese cliente (CAC real)

Esto permite calcular **ROAS real** por campaña, no solo el que reporta Meta.

---

## 🤖 NIVEL 7 — El Agente Maestro (AI Marketing Copilot)

### Concepto
Un agente AI interno que tiene acceso a TODOS los datos y TODAS las APIs, y actúa como un equipo de marketing completo:

### Lo que puede hacer el agente (por comando del dueño):

```
Dueño: "Lanza una campaña para el nuevo sérum"
Agente: 
1. Analiza productos similares que han vendido bien
2. Identifica audiencia ideal (Lookalike de compradores de skincare)
3. Genera 3 variantes de copy + sugiere imágenes del catálogo
4. Crea campaña en Meta con presupuesto sugerido ($50K/día)
5. Configura retargeting automático para visitantes que no compren
6. Programa WhatsApp para clientes que preguntaron por sérum antes
7. Publica en Instagram con shopping tags
8. Reporta resultados diarios
```

```
Dueño: "¿Por qué bajaron las ventas esta semana?"
Agente:
1. Analiza ventas vs. semana anterior por canal
2. Revisa performance de campañas activas
3. Analiza conversaciones (¿hay objeciones nuevas?)
4. Revisa stock (¿productos agotados?)
5. Compara con tendencias estacionales
→ "Las ventas bajaron 20% porque la campaña 'Verano' agotó presupuesto el martes 
   y no se renovó. Además, el Sérum Vitamina C está agotado y representa 15% de 
   las ventas. Recomiendo: 1) Renovar presupuesto a $80K, 2) Notificar clientes 
   cuando el sérum vuelva al stock."
```

```
Dueño: "Necesito $5M en ventas este mes"
Agente:
1. Analiza ticket promedio ($101.500) → necesitas ~50 órdenes
2. Analiza tasa de conversión (8.7%) → necesitas ~575 conversaciones
3. Analiza costo por conversación desde ads → presupuesto necesario
4. Propone plan: X en Meta Ads, Y en WhatsApp marketing, Z en Instagram
5. Ejecuta el plan si el dueño aprueba
6. Monitorea progreso diario y ajusta
```

### Herramientas del Agente Maestro (nuevas)

| Herramienta | Descripción |
|-------------|-------------|
| `create_meta_campaign` | Crear campaña con objetivo, audiencia, presupuesto, creativos |
| `update_campaign_budget` | Ajustar presupuesto de campaña activa |
| `pause_campaign` | Pausar campaña con mal ROAS |
| `create_custom_audience` | Subir lista de clientes a Meta |
| `create_lookalike` | Crear Lookalike desde Custom Audience |
| `sync_catalog` | Sincronizar productos con Meta Commerce |
| `send_whatsapp_broadcast` | Enviar mensaje masivo a segmento |
| `schedule_instagram_post` | Programar publicación con shopping tags |
| `get_campaign_insights` | Obtener métricas de campañas |
| `analyze_customer_segment` | Analizar comportamiento de un segmento |
| `forecast_sales` | Proyección de ventas basada en tendencias |
| `generate_ad_creative` | Generar copy + sugerir imágenes para ad |
| `get_funnel_analysis` | Análisis de embudo completo |
| `get_attribution_report` | Reporte de atribución cross-channel |

---

## 📊 NIVEL 8 — Dashboard de Inteligencia

### Vista actual (lo que ya tenemos)
- KPIs básicos (ingresos, conversaciones, conversión, ticket)
- Tendencias, fuentes de tráfico, embudo, origen de ventas
- Meta Ads card con métricas de campañas

### Vista propuesta
1. **Marketing Intelligence**
   - ROAS real por campaña (incluyendo ventas por chat atribuidas)
   - CAC (Costo de Adquisición) por canal
   - LTV (Lifetime Value) por cohorte de clientes
   - Proyección de ingresos del mes

2. **Customer Intelligence**
   - Mapa de calor de navegación (PostHog)
   - Funnel completo: Ad → Visit → Chat → Cart → Purchase
   - Scoring de clientes activos
   - Clientes en riesgo de churn

3. **AI Performance**
   - Tasa de conversión del agente vs. sin agente
   - Tiempo promedio de conversación → venta
   - Herramientas más usadas por el agente
   - Preguntas que el agente no pudo responder

4. **Content Performance**
   - Posts de Instagram por engagement → ventas
   - Mejores horarios de publicación
   - Tipos de contenido que convierten
   - Hashtags con mejor performance

---

## 🗺️ Roadmap de Implementación

### Fase A — Fundamentos (Semanas 1-2)
- [x] Meta Pixel + CAPI con deduplicación
- [x] Meta Ads card en dashboard con data real
- [x] CAPI en Wompi + ePayco
- [ ] Sync de catálogo con Meta Commerce (`catalog_management`)
- [ ] WhatsApp templates para post-compra (confirmación, envío)
- [ ] Activar PostHog en producción

### Fase B — Automatización Básica (Semanas 3-4)
- [ ] Recuperación de carrito por WhatsApp (30min + 24h)
- [ ] Custom Audiences automáticas (compradores, abandonos)
- [ ] Instagram DM commerce (mismo agente, nuevo canal)
- [ ] Comment auto-response en Instagram
- [ ] Lead forms → WhatsApp auto-contact

### Fase C — Agente de Analytics (Semanas 5-6)
- [ ] Briefing diario por WhatsApp al dueño
- [ ] Detección de anomalías (CTR, conversión, stock)
- [ ] Customer scoring predictivo
- [ ] Análisis de conversaciones (objeciones, sentimiento)
- [ ] Dashboard de inteligencia v2

### Fase D — Motor de Campañas AI (Semanas 7-8)
- [ ] Creación automática de campañas desde el chat del dueño
- [ ] Lookalike audiences desde mejores clientes
- [ ] Auto-optimización de presupuesto (pause/scale)
- [ ] Dynamic Product Ads desde catálogo
- [ ] Instagram auto-post con shopping tags

### Fase E — Agente Maestro (Semanas 9-12)
- [ ] Todas las herramientas del agente conectadas
- [ ] Flujos cross-channel orquestados
- [ ] Attribution completa (ad → chat → venta)
- [ ] Forecast y recomendaciones proactivas
- [ ] El dueño maneja TODO su marketing desde un chat

---

## 💰 Impacto para el Cliente

| Métrica | Sin LandingChat | Con LandingChat AI Engine |
|---------|-----------------|--------------------------|
| Tiempo para lanzar campaña | 2-4 horas | 5 minutos (comando al agente) |
| Costo de agencia de marketing | $2-5M/mes | $0 (incluido en la plataforma) |
| Recuperación de carritos | 0% | 15-25% (WhatsApp + retargeting) |
| Tiempo de respuesta a leads | Horas/días | < 5 minutos (automático) |
| Attribution accuracy | ~40% (solo Meta) | ~90% (cross-channel) |
| Decisiones de presupuesto | Intuición | Data-driven (AI recomienda) |

## 🎯 Diferenciador vs. Competencia

- **Shopify**: Tiene apps, pero no inteligencia. El dueño tiene que configurar todo manualmente.
- **LandingChat**: La IA ES el equipo de marketing. Analiza, recomienda, ejecuta, optimiza. El dueño solo aprueba.

**No vendemos una tienda online. Vendemos un equipo de marketing AI que además tiene una tienda.**

---

> "La mejor agencia de marketing del mundo, pero es una IA que cuesta $249K/mes"
