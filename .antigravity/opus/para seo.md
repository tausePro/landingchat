1. SEO para las tiendas
Estado actual: 🔴 No optimizado
Las tiendas son client-side rendered (React con "use client"), lo que significa que Google ve una página vacía inicialmente.
Lo que necesitamos
Metadata dinámica por tienda:
tienda-juan.landingchat.co
├── Title: "Zapatería Juan | Las mejores zapatillas en Bogotá"
├── Description: "Encuentra zapatillas deportivas, casuales y formales..."
├── Open Graph (para compartir en redes)
├── Canonical URL
└── Structured Data (JSON-LD para productos)
Server-Side Rendering (SSR) o Static Generation:

Las páginas de tienda deberían renderizarse en el servidor
Next.js lo soporta nativamente, solo hay que refactorizar

Sitemap dinámico:
landingchat.co/sitemap.xml
├── tienda-juan.landingchat.co
├── tienda-juan.landingchat.co/p/zapatilla-runner
├── tienda-maria.landingchat.co
└── ...
Robots.txt:
User-agent: *
Allow: /
Sitemap: https://landingchat.co/sitemap.xml
Cuándo hacerlo
Después del MVP funcional. Es importante pero no bloquea el lanzamiento.

2. Posicionamiento en IAs (GEO - Generative Engine Optimization)
Qué es esto
Cuando alguien le pregunta a ChatGPT, Claude, Perplexity, etc: "¿Dónde compro zapatillas en Bogotá?", queremos que recomiende tiendas de LandingChat.
Cómo funcionan las IAs para esto

Datos de entrenamiento: Ya pasó, no podemos influir
Búsqueda en tiempo real: Perplexity, Bing Chat, Google AI buscan la web
Structured data: Las IAs entienden mejor datos estructurados

Estrategia para LandingChat
Para las tiendas individuales:

Schema.org markup (LocalBusiness, Product, Offer)
Contenido descriptivo y natural (no keyword stuffing)
Reviews y ratings estructurados
Información de contacto clara

Para LandingChat como plataforma:

Blog con contenido sobre chat commerce en Latam
Casos de éxito de tiendas
Presencia en directorios de SaaS
Documentación pública indexable

Ejemplo de structured data para una tienda:
json{
  "@context": "https://schema.org",
  "@type": "Store",
  "name": "Zapatería Juan",
  "description": "Tienda de zapatillas en Bogotá",
  "url": "https://zapateria-juan.landingchat.co",
  "telephone": "+573001234567",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Bogotá",
    "addressCountry": "CO"
  },
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Zapatillas",
    "itemListElement": [...]
  }
}
```

### Cuándo hacerlo
Fase 2, junto con SEO. Es relativamente fácil de implementar una vez que el SEO básico esté.

---

## 3. Integración con Meta (Facebook/Instagram)

### Lo que necesitamos

**A. Meta Pixel (tracking de conversiones)**
```
- PageView: Cuando alguien entra a la tienda
- ViewContent: Cuando ve un producto
- AddToCart: Cuando agrega al carrito
- InitiateCheckout: Cuando inicia checkout
- Purchase: Cuando completa compra
```

**B. Conversions API (server-side)**
- Más preciso que el pixel (no lo bloquean adblockers)
- Envía eventos desde el servidor
- Mejor atribución de conversiones

**C. Catálogo de productos**
- Sincronizar productos con Meta Commerce
- Permite anuncios dinámicos de productos
- Retargeting automático

**D. Click to WhatsApp Ads**
- Anuncios que abren directamente el chat
- Atribución de conversiones desde el anuncio
- Integración con la API de WhatsApp Business

### Cómo funcionaría para el comerciante
```
Dashboard > Integraciones > Meta

┌─────────────────────────────────────────────┐
│ Conectar con Facebook                        │
│                                              │
│ [🔵 Conectar cuenta de Facebook]            │
│                                              │
│ Al conectar podrás:                         │
│ ✓ Trackear conversiones con el Pixel        │
│ ✓ Crear audiencias de retargeting           │
│ ✓ Sincronizar tu catálogo de productos      │
│ ✓ Medir ROI de tus campañas                 │
└─────────────────────────────────────────────┘
```

Una vez conectado:
```
Dashboard > Integraciones > Meta

Pixel ID: 123456789012345 ✓ Activo
Eventos últimas 24h:
- PageView: 234
- ViewContent: 89
- AddToCart: 23
- Purchase: 5

[Ver en Meta Events Manager →]
Implementación técnica
Pixel (client-side):
typescript// Inyectar en el <head> de cada tienda
<script>
  fbq('init', '{PIXEL_ID}');
  fbq('track', 'PageView');
</script>
Conversions API (server-side):
typescript// Cuando se completa una compra
await fetch('https://graph.facebook.com/v18.0/{PIXEL_ID}/events', {
  method: 'POST',
  body: JSON.stringify({
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      user_data: {
        ph: hashPhone(customer.phone),
        external_id: hashId(customer.id)
      },
      custom_data: {
        currency: 'COP',
        value: order.total
      }
    }],
    access_token: META_ACCESS_TOKEN
  })
})
```

### Cuándo hacerlo
Fase 3, después de que haya tiendas activas con ventas. Es crítico para el growth pero no para el MVP.

---

## 4. Otros píxeles y tracking

### Google Analytics 4
```
Dashboard > Integraciones > Google Analytics

Measurement ID: G-XXXXXXXXXX

Eventos trackeados:
- page_view
- view_item
- add_to_cart
- begin_checkout
- purchase
```

### Google Ads (conversiones)

Similar a Meta, para medir ROI de campañas de Google.

### TikTok Pixel

Para comerciantes que anuncian en TikTok (cada vez más común en Latam).

### Hotjar/Clarity (mapas de calor)

Para entender cómo navegan los usuarios.

---

## 5. Arquitectura recomendada para tracking

### Opción A: Cada comerciante configura sus píxeles
```
Dashboard > Configuración > Tracking

Meta Pixel ID: [________________]
Google Analytics ID: [________________]
TikTok Pixel ID: [________________]

[Guardar]
```

**Pros:** Simple, el comerciante tiene control total
**Contras:** Muchos no saben configurarlo

### Opción B: LandingChat como hub centralizado
```
1. Comerciante conecta cuentas (OAuth)
2. LandingChat genera píxeles automáticamente
3. Eventos se envían a todas las plataformas
4. Dashboard unificado de métricas
Pros: Experiencia superior, diferenciador
Contras: Más complejo de implementar
Mi recomendación: Híbrido
MVP: Opción A (campos para pegar IDs)
Fase 2: Agregar Conversions API server-side
Fase 3: Opción B con conexiones OAuth