# Integración WhatsApp con Evolution API

## Introducción

Integración de WhatsApp como canal de comunicación para ventas conversacionales, permitiendo a las organizaciones conectar su WhatsApp corporativo para atención al cliente y recibir notificaciones de ventas en su WhatsApp personal.

## Glosario

- **Evolution API**: Plataforma de gestión de WhatsApp que permite crear instancias y enviar/recibir mensajes via API REST
- **Instancia**: Conexión individual de WhatsApp en Evolution API, una por organización
- **Baileys**: Librería que permite conectar WhatsApp Web sin cuenta de negocio oficial
- **Canal**: Medio de comunicación (web chat, WhatsApp corporativo, WhatsApp personal)
- **Conversación**: Hilo de mensajes entre un cliente y una tienda, puede cruzar canales

## Requisitos

### Requisito 1: Configuración de Evolution API (Admin)

**User Story:** Como administrador de la plataforma, quiero configurar la conexión con Evolution API, para que las organizaciones puedan conectar sus WhatsApp.

**Criterios de Aceptación:**
1. WHEN el administrador accede a configuración de Evolution THEN el sistema SHALL mostrar formulario para URL y API Key
2. WHEN el administrador guarda la configuración THEN el sistema SHALL validar la conexión antes de guardar
3. WHEN la conexión falla THEN el sistema SHALL mostrar mensaje de error descriptivo
4. WHEN la configuración es exitosa THEN el sistema SHALL almacenar las credenciales de forma segura

### Requisito 2: Conexión de WhatsApp Corporativo

**User Story:** Como propietario de tienda, quiero conectar mi WhatsApp corporativo desde el dashboard, para atender clientes por este canal.

**Criterios de Aceptación:**
1. WHEN el usuario accede a configuración de WhatsApp THEN el sistema SHALL mostrar estado actual de conexión
2. WHEN el usuario hace click en "Conectar WhatsApp" THEN el sistema SHALL crear instancia en Evolution API y mostrar código QR
3. WHEN el código QR es escaneado exitosamente THEN el sistema SHALL actualizar estado a "conectado" y mostrar número de teléfono
4. WHEN la sesión de WhatsApp se desconecta THEN el sistema SHALL notificar al usuario y permitir reconexión
5. WHILE el plan del usuario no incluye WhatsApp THEN el sistema SHALL mostrar mensaje de upgrade requerido

### Requisito 3: Recepción de Mensajes WhatsApp

**User Story:** Como sistema, quiero recibir mensajes de WhatsApp de los clientes, para procesarlos con el agente IA.

**Criterios de Aceptación:**
1. WHEN Evolution API envía webhook de mensaje entrante THEN el sistema SHALL identificar la organización por instancia
2. WHEN se recibe mensaje de cliente nuevo THEN el sistema SHALL crear registro de cliente y conversación
3. WHEN se recibe mensaje de cliente existente THEN el sistema SHALL agregar mensaje a conversación existente
4. WHEN el mensaje es procesado THEN el sistema SHALL enviar al agente IA para generar respuesta
5. IF el webhook tiene firma inválida THEN el sistema SHALL rechazar el mensaje

### Requisito 4: Envío de Mensajes WhatsApp

**User Story:** Como agente IA, quiero enviar respuestas por WhatsApp, para mantener la conversación con el cliente.

**Criterios de Aceptación:**
1. WHEN el agente genera respuesta THEN el sistema SHALL enviar mensaje via Evolution API
2. WHEN el mensaje incluye productos THEN el sistema SHALL formatear con imagen y precio
3. WHEN el mensaje incluye link de pago THEN el sistema SHALL enviar como mensaje con botón
4. IF el envío falla THEN el sistema SHALL reintentar hasta 3 veces con backoff exponencial
5. WHEN el mensaje es enviado THEN el sistema SHALL registrar en historial de conversación

### Requisito 5: Continuidad Cross-Channel

**User Story:** Como cliente, quiero continuar mi conversación en cualquier canal, para no perder el contexto de mi compra.

**Criterios de Aceptación:**
1. WHEN un cliente escribe por WhatsApp y luego por web chat THEN el sistema SHALL unificar ambas conversaciones
2. WHEN el sistema identifica cliente por teléfono THEN el sistema SHALL cargar historial de conversaciones previas
3. WHEN el agente responde THEN el sistema SHALL usar el contexto de todos los canales
4. WHEN el cliente cambia de canal THEN el sistema SHALL mantener el carrito y estado de compra

### Requisito 6: Notificaciones al Propietario

**User Story:** Como propietario de tienda, quiero recibir notificaciones de ventas en mi WhatsApp personal, para estar informado en tiempo real.

**Criterios de Aceptación:**
1. WHEN el usuario configura WhatsApp personal THEN el sistema SHALL solicitar número de teléfono
2. WHEN se completa una venta THEN el sistema SHALL enviar notificación con detalles del pedido
3. WHEN el stock de un producto baja del mínimo THEN el sistema SHALL enviar alerta
4. WHEN hay una nueva conversación THEN el sistema SHALL enviar notificación (configurable)
5. WHILE las notificaciones están desactivadas THEN el sistema SHALL no enviar mensajes

### Requisito 7: Límites por Plan

**User Story:** Como plataforma, quiero controlar el uso de WhatsApp según el plan, para mantener costos controlados.

**Criterios de Aceptación:**
1. WHEN una organización alcanza su límite de conversaciones THEN el sistema SHALL bloquear nuevas conversaciones entrantes
2. WHEN el uso supera el 80% del límite THEN el sistema SHALL mostrar alerta en dashboard
3. WHEN el mes cambia THEN el sistema SHALL reiniciar contador de conversaciones
4. WHILE el plan es gratuito THEN el sistema SHALL limitar a 50 conversaciones mensuales

### Requisito 8: Gestión de Instancias (Admin)

**User Story:** Como administrador, quiero ver y gestionar todas las instancias de WhatsApp, para monitorear el uso de la plataforma.

**Criterios de Aceptación:**
1. WHEN el admin accede al panel de instancias THEN el sistema SHALL mostrar lista de todas las instancias con estado
2. WHEN una instancia está desconectada por más de 24h THEN el sistema SHALL marcarla como inactiva
3. WHEN el admin desconecta una instancia THEN el sistema SHALL eliminarla de Evolution API
4. WHEN el admin busca por organización THEN el sistema SHALL filtrar instancias correspondientes

## Requisitos No Funcionales

### Rendimiento
- 5.1 Los webhooks de Evolution API se procesan en menos de 5 segundos
- 5.2 El código QR se muestra en menos de 3 segundos después de solicitarlo

### Seguridad
- 5.3 Las credenciales de Evolution API se almacenan encriptadas
- 5.4 Los webhooks validan firma para evitar falsificación
- 5.5 Los números de teléfono se almacenan hasheados para privacidad

### Disponibilidad
- 5.6 Si Evolution API no responde, el sistema muestra mensaje amigable
- 5.7 Reintentos automáticos para mensajes fallidos
