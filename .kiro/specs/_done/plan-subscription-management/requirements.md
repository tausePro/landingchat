# Documento de Requisitos

## Introducción

Este documento define los requisitos para implementar la gestión de planes de suscripción en el panel de administración de LandingChat, incluyendo la integración con Wompi como pasarela de pagos para cobrar las suscripciones de la plataforma a las organizaciones (clientes B2B).

## Glosario

- **Plan**: Configuración de suscripción que define límites, características y precio para las organizaciones
- **Suscripción**: Relación activa entre una organización y un plan, con ciclo de facturación
- **Organización**: Cliente B2B que usa LandingChat para crear su tienda conversacional
- **Wompi**: Pasarela de pagos colombiana para procesar transacciones
- **MRR**: Monthly Recurring Revenue - Ingresos recurrentes mensuales
- **Superadmin**: Administrador de la plataforma LandingChat con acceso al panel `/admin`

## Requisitos

### Requisito 1

**Historia de Usuario:** Como superadmin, quiero crear y gestionar planes de suscripción, para poder definir diferentes niveles de servicio y precios para las organizaciones.

#### Criterios de Aceptación

1. WHEN el superadmin accede a la sección de planes THEN el sistema SHALL mostrar una lista de todos los planes existentes con nombre, precio, límites y estado
2. WHEN el superadmin crea un nuevo plan THEN el sistema SHALL validar que el nombre sea único y guardar el plan con todos sus atributos
3. WHEN el superadmin edita un plan existente THEN el sistema SHALL actualizar los atributos del plan sin afectar las suscripciones activas
4. WHEN el superadmin desactiva un plan THEN el sistema SHALL marcar el plan como inactivo y prevenir nuevas suscripciones a ese plan
5. WHEN se muestra un plan THEN el sistema SHALL mostrar los límites configurados: productos máximos, agentes máximos, conversaciones mensuales

### Requisito 2

**Historia de Usuario:** Como superadmin, quiero ver el estado de las suscripciones de todas las organizaciones, para poder monitorear la salud financiera de la plataforma.

#### Criterios de Aceptación

1. WHEN el superadmin accede al dashboard THEN el sistema SHALL mostrar métricas de MRR, suscripciones activas y organizaciones por plan
2. WHEN el superadmin lista las suscripciones THEN el sistema SHALL mostrar organización, plan, estado, fecha de inicio y próxima facturación
3. WHEN una suscripción cambia de estado THEN el sistema SHALL registrar el cambio con timestamp para auditoría
4. WHEN el superadmin filtra suscripciones por estado THEN el sistema SHALL mostrar solo las suscripciones que coincidan con el filtro seleccionado

### Requisito 3

**Historia de Usuario:** Como superadmin, quiero configurar la integración con Wompi, para poder procesar los pagos de suscripciones automáticamente.

#### Criterios de Aceptación

1. WHEN el superadmin configura las credenciales de Wompi THEN el sistema SHALL almacenar las llaves de forma segura y validar la conexión
2. WHEN se procesa un pago de suscripción THEN el sistema SHALL crear una transacción en Wompi y registrar el resultado
3. WHEN Wompi envía un webhook de pago exitoso THEN el sistema SHALL actualizar el estado de la suscripción a activo
4. WHEN Wompi envía un webhook de pago fallido THEN el sistema SHALL marcar la suscripción como past_due y notificar al sistema
5. WHEN se serializa una transacción para enviar a Wompi THEN el sistema SHALL formatear los datos según la especificación de la API de Wompi

### Requisito 4

**Historia de Usuario:** Como organización, quiero ver mi plan actual y límites de uso, para poder entender qué recursos tengo disponibles.

#### Criterios de Aceptación

1. WHEN la organización accede a su dashboard THEN el sistema SHALL mostrar el plan actual, estado de suscripción y próxima fecha de cobro
2. WHEN la organización consulta su uso THEN el sistema SHALL mostrar el consumo actual vs límites del plan (productos, agentes, conversaciones)
3. WHEN la organización se acerca al límite de un recurso THEN el sistema SHALL mostrar una alerta visual indicando el porcentaje de uso
4. WHEN la organización excede un límite THEN el sistema SHALL bloquear la acción y mostrar mensaje indicando que debe actualizar su plan

### Requisito 5

**Historia de Usuario:** Como sistema, quiero validar los datos de planes y suscripciones, para garantizar la integridad de la información financiera.

#### Criterios de Aceptación

1. WHEN se crea o actualiza un plan THEN el sistema SHALL validar que el precio sea un número positivo y la moneda sea válida
2. WHEN se crea una suscripción THEN el sistema SHALL validar que la organización exista y el plan esté activo
3. WHEN se procesa una fecha de facturación THEN el sistema SHALL validar que las fechas de período sean coherentes (inicio menor que fin)
4. WHEN se serializa un plan para almacenamiento THEN el sistema SHALL convertir los datos al formato correcto de la base de datos
5. WHEN se deserializa un plan desde la base de datos THEN el sistema SHALL reconstruir el objeto con todos sus atributos tipados correctamente
