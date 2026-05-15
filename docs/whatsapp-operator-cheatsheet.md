# 🤖 Cheatsheet del operador — Control IA por WhatsApp

> Guía rápida para operadores humanos que atienden clientes en WhatsApp.
> Permite pausar/reactivar la IA, marcar clientes "solo humano", ver estado
> de un chat y cerrarlo, sin abrir el dashboard.

**Versión:** v1.13.0 · **Última actualización:** 2026-05-14

---

## TL;DR (lo esencial)

| Quiero…                                 | Comando                |
| --------------------------------------- | ---------------------- |
| Pausar la IA en este chat               | `/yo` o `/pausar`      |
| Reactivar la IA en este chat            | `/bot` o `/reanudar`   |
| Ver estado del chat                     | `/info` o `/estado`    |
| Marcar cliente como "solo humano"       | `/whitelist`           |
| Quitar el "solo humano"                 | `/unwhitelist`         |
| Cerrar el chat                          | `/cerrar` o `/resolver`|
| Ver esta ayuda en WhatsApp              | `/help` o `/ayuda`     |

---

## ⚡ Comportamiento automático: la "pausa suave"

**Cuando respondes a un cliente sin usar comando, la IA se pausa
automáticamente en ese chat por un tiempo configurable (30 minutos por
defecto).**

- Si terminas antes y quieres devolverle la palabra a la IA: usa `/bot`.
- Si quieres pausa permanente (hasta que tú decidas reactivar): usa `/yo`.
- Si quieres que la IA **NUNCA** responda a ese cliente: usa `/whitelist`.

Esta pausa suave es para evitar que la IA "atropelle" tu respuesta mientras
estás escribiendo.

### ⚙️ Configuración por organización (v1.13.0+)

Desde **Dashboard → Configuración → Organización → pestaña WhatsApp** puedes
ajustar la duración de esta pausa entre **0 y 240 minutos**.

- **`0`** desactiva la pausa automática: la IA siempre responde, incluso
  si tú estás respondiendo el chat. Útil para tenants donde IA y humano
  trabajan en paralelo. Si necesitas pausar puntualmente un chat, usa
  `/yo`.
- **`30`** (default) es el comportamiento clásico.
- **`240`** (4 horas) es el máximo permitido.

Usa `/help` desde WhatsApp para ver el valor configurado actualmente en
esa organización.

---

## 🎯 Comandos detallados

### `/yo` — Pausar IA (yo respondo)

**Qué hace:** desactiva la IA en este chat de forma permanente hasta que la
reactives con `/bot`.

**Cuándo usarlo:**
- El cliente necesita una respuesta humana compleja (cierre de venta,
  reclamo, situación delicada).
- Quieres asegurarte de que la IA no responda nada hasta que termines.

**Ejemplo:**

```
/yo
```

Respuesta:
> 🤖 IA pausada. Tú respondes a este cliente.
> Usa */bot* para reactivar la IA cuando termines.

---

### `/bot` — Reactivar IA

**Qué hace:** vuelve a activar la IA. También limpia cualquier pausa
automática vigente.

**Cuándo usarlo:**
- Terminaste de atender al cliente y quieres que la IA vuelva a manejarlo.
- Pasó algo y prefieres que la IA tome el control de nuevo.

```
/bot
```

> 🤖 IA reactivada. Volverá a responder automáticamente a este cliente.

---

### `/info` — Ver estado del chat

**Qué hace:** muestra cómo está configurado este chat. No cambia nada.

**Cuándo usarlo:**
- No estás seguro si la IA está activa o pausada.
- Quieres saber si el cliente está en whitelist.

```
/info
```

> 📊 *Estado del chat*
> • *Estado:* 🔓 Abierto
> • *IA:* ✅ IA activa
> • *Solo humano:* ❌ No

---

### `/whitelist` — Marcar cliente "solo humano"

**Qué hace:** marca al cliente como `solo humano` de manera **permanente**.
La IA **nunca** volverá a responderle automáticamente, sin importar el
estado de pausa del chat.

**Cuándo usarlo:**
- Cliente VIP que siempre debes atender tú.
- Cliente sensible (reclamo activo, situación legal).
- Cliente que pidió expresamente "no me responda un bot".

```
/whitelist
```

> 🔒 Cliente marcado como *solo humano*.
> La IA nunca volverá a responderle automáticamente.

⚠️ **Importante:** la whitelist se aplica al **cliente**, no al chat. Si el
mismo cliente abre un chat nuevo, sigue protegido por la whitelist.

---

### `/unwhitelist` — Quitar whitelist

**Qué hace:** revierte la marca de "solo humano". El cliente vuelve al
flujo normal donde la IA puede responderle si el chat está activo.

```
/unwhitelist
```

> 🔓 Cliente quitado de *solo humano*.
> La IA puede responderle de nuevo según el flujo normal.

---

### `/cerrar` — Cerrar chat

**Qué hace:** marca el chat como resuelto (igual al botón "Resolver" del
dashboard). Si el cliente vuelve a escribir, el chat se reabre
automáticamente.

```
/cerrar
```

> ✅ Chat cerrado.
> Si el cliente vuelve a escribir, se reabrirá automáticamente.

---

### `/help` — Ver lista de comandos

```
/help
```

Devuelve la lista completa de comandos.

---

## 🧭 Casos de uso reales

### Caso 1: Cliente urgente que necesita atención humana

1. Llega un mensaje. La IA responde con sus opciones de venta.
2. El cliente escribe: "necesito hablar con alguien YA".
3. **Tú escribes tu respuesta directamente** (sin comando):
   ```
   Hola, soy Cris. Cuéntame qué pasa.
   ```
   → La IA se pausa automáticamente (30 min por defecto, configurable).
4. Conversas con el cliente.
5. Cuando termines, opcional: `/bot` para devolverle el chat a la IA.

### Caso 2: Cliente VIP que SIEMPRE atiendes tú

1. La primera vez que interactúas, escribe `/whitelist` en el chat.
2. La IA queda bloqueada **para siempre** con ese cliente.
3. Cuando ya no aplique, escribe `/unwhitelist`.

### Caso 3: Te confundiste y la IA está pausada de más

1. Si no recuerdas cómo está el chat: `/info`.
2. Si quieres reactivar la IA: `/bot`.

### Caso 4: Cliente resolvió su consulta

1. Confirma con el cliente que quedó atendido.
2. `/cerrar` → el chat queda como resuelto.
3. Si vuelve a escribir, el chat se reabre solo.

---

## ❓ FAQ

**¿Los comandos los ve el cliente?**
No. Los comandos los envías desde tu WhatsApp Business app y el sistema los
intercepta antes de que lleguen al cliente. El cliente solo ve tus
respuestas normales.

**¿Cómo sé que el comando funcionó?**
Te responderá un mensaje del sistema confirmando la acción (los emojis 🤖,
🔒, ✅ son de las respuestas del sistema).

**¿Qué pasa si me equivoco de comando?**
El sistema te dice "Comando no reconocido" y te recuerda usar `/help`.

**¿Puedo usar comandos en mayúsculas?**
Sí. `/YO`, `/Yo` y `/yo` son equivalentes.

**¿Los comandos funcionan en chats web (no WhatsApp)?**
No. Solo en WhatsApp. Para chats web del e-commerce usa el dashboard.

**¿Y si quiero cambiar el cliente de whitelist desde el dashboard?**
Sí: entra al chat en la consola, mira el sidebar derecho del cliente, en
el bloque **"Control de IA"** verás el toggle **"Solo humano"**.

---

## 📋 Plantilla para enviarle a un operador nuevo

Texto listo para copiar y pegar en WhatsApp:

```
¡Hola! 👋 Te dejo el cheatsheet de los comandos para controlar la IA
desde WhatsApp.

📌 LO BÁSICO

• Si respondes un mensaje SIN comando, la IA se pausa automáticamente
  (30 min por defecto, configurable desde el dashboard).
• Si quieres pausa permanente: */yo*
• Si quieres devolverle el chat a la IA: */bot*

📌 COMANDOS PRINCIPALES

*/yo* — Yo respondo (pausa IA)
*/bot* — Reactiva IA
*/info* — Estado del chat
*/whitelist* — Cliente "solo humano" (IA nunca responde)
*/unwhitelist* — Quitar "solo humano"
*/cerrar* — Cerrar chat
*/help* — Ver esta ayuda

📌 EJEMPLO

Cliente escribe → IA responde
Cliente: "quiero hablar con humano"
Tú escribes tu respuesta normal → IA se pausa automáticamente ✅
Cuando termines, opcional: */bot*

📌 TIP

Escribe */info* cuando no sepas en qué estado está el chat.

Cualquier duda, me avisas 🙌
```

---

## 🔗 Referencias técnicas

- Implementación: `src/lib/whatsapp/operator-commands.ts`
- Integración con pipeline IA: `src/lib/messaging/unified.ts`
- UI dashboard: `src/app/dashboard/chats/console/components/customer-sidebar.tsx`
- Migración DB: `migrations/20260513_whatsapp_operator_controls.sql`
- Tests: `src/__tests__/whatsapp/operator-commands.test.ts`
