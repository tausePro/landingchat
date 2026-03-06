import Anthropic from "@anthropic-ai/sdk"

// ═══════════════════════════════════════════════════════════════════
// Tools compartidas — Usadas por TODOS los modos (e-commerce, real estate, hybrid)
// ═══════════════════════════════════════════════════════════════════

export const sharedTools: Anthropic.Tool[] = [
    // ==================== IDENTIFICACIÓN ====================
    {
        name: "identify_customer",
        description: "Identifica o crea un cliente con su información de contacto. USAR AL INICIO de cada conversación nueva cuando el cliente proporcione su nombre y contacto.",
        input_schema: {
            type: "object" as const,
            properties: {
                name: {
                    type: "string",
                    description: "Nombre completo del cliente"
                },
                email: {
                    type: "string",
                    description: "Email del cliente (opcional si tiene teléfono)"
                },
                phone: {
                    type: "string",
                    description: "Teléfono o WhatsApp del cliente (opcional si tiene email)"
                }
            },
            required: ["name"]
        }
    },

    // ==================== INFORMACIÓN ====================
    {
        name: "get_store_info",
        description: "Obtiene información de la tienda como horarios, políticas de envío, devoluciones, etc.",
        input_schema: {
            type: "object" as const,
            properties: {
                topic: {
                    type: "string",
                    description: "Tema específico: 'shipping', 'returns', 'hours', 'payment_methods', 'contact'"
                }
            }
        }
    },
    {
        name: "get_order_status",
        description: "Consulta el estado de una orden existente.",
        input_schema: {
            type: "object" as const,
            properties: {
                order_id: {
                    type: "string",
                    description: "ID de la orden (si lo tiene)"
                },
                email: {
                    type: "string",
                    description: "Email usado en la compra (alternativa al order_id)"
                }
            }
        }
    },
    {
        name: "get_customer_history",
        description: "Obtiene el historial de compras y preferencias del cliente actual. Usar para personalizar recomendaciones.",
        input_schema: {
            type: "object" as const,
            properties: {}
        }
    },

    // ==================== CITAS (compartida — aplica a ambos modos) ====================
    {
        name: "check_availability",
        description: "Consulta la disponibilidad de horarios para agendar citas. Revisa Google Calendar (si está conectado) y las citas existentes en la plataforma. USAR ANTES de schedule_appointment para ofrecer horarios reales al cliente.",
        input_schema: {
            type: "object" as const,
            properties: {
                date: {
                    type: "string",
                    description: "Fecha para consultar disponibilidad en formato ISO 8601 (ej: '2026-02-27'). Si el cliente dice 'mañana', calcula la fecha correcta."
                },
                days_ahead: {
                    type: "number",
                    description: "Número de días a consultar desde la fecha indicada (default 1, máximo 7)"
                }
            },
            required: ["date"]
        }
    },
    {
        name: "schedule_appointment",
        description: "Agenda una cita o visita con el cliente. Usar cuando el cliente quiere agendar una visita a una propiedad, una consulta, una llamada o una reunión. Recolecta fecha, hora y tipo de cita.",
        input_schema: {
            type: "object" as const,
            properties: {
                title: {
                    type: "string",
                    description: "Título de la cita (ej: 'Visita apartamento Laureles', 'Consulta de arriendo')"
                },
                proposed_date: {
                    type: "string",
                    description: "Fecha y hora propuesta en formato ISO 8601 (ej: '2026-02-17T10:00:00'). Si el cliente dice 'mañana a las 10', calcula la fecha correcta usando la fecha actual del sistema."
                },
                duration_minutes: {
                    type: "number",
                    description: "Duración en minutos (default 60)"
                },
                appointment_type: {
                    type: "string",
                    description: "Tipo: 'visit' (visita presencial), 'consultation' (consulta), 'call' (llamada), 'meeting' (reunión)"
                },
                location: {
                    type: "string",
                    description: "Ubicación de la cita (dirección, nombre del lugar, o 'virtual')"
                },
                location_type: {
                    type: "string",
                    description: "Modalidad: 'in_person', 'video_call', 'phone_call'"
                },
                customer_name: {
                    type: "string",
                    description: "Nombre del cliente"
                },
                customer_phone: {
                    type: "string",
                    description: "Teléfono del cliente"
                },
                customer_email: {
                    type: "string",
                    description: "Email del cliente (opcional)"
                },
                notes: {
                    type: "string",
                    description: "Notas adicionales sobre la cita"
                },
                property_code: {
                    type: "string",
                    description: "Código de la propiedad (ej: 'ARR-137', '1436'). Si la cita es para visitar una propiedad específica, incluye su código. La ubicación se auto-completa con la dirección de la propiedad."
                }
            },
            required: ["title", "proposed_date", "customer_name"]
        }
    },

    // ==================== MEDIA / ARCHIVOS ====================
    {
        name: "send_media",
        description: "Envía un archivo multimedia (PDF, catálogo, audio, imagen) al cliente. Usa esta herramienta cuando necesites compartir documentos, catálogos de productos, hojas de requisitos, audios informativos u otros archivos que la organización haya configurado. Consulta la lista de ARCHIVOS DISPONIBLES en el contexto del sistema para saber qué archivos puedes enviar.",
        input_schema: {
            type: "object" as const,
            properties: {
                media_id: {
                    type: "string",
                    description: "ID del archivo multimedia a enviar. Debe ser uno de los IDs listados en ARCHIVOS DISPONIBLES."
                },
                context_message: {
                    type: "string",
                    description: "Mensaje breve que acompaña al archivo (ej: 'Aquí tienes los requisitos de arriendo')"
                }
            },
            required: ["media_id"]
        }
    },

    // ==================== ESCALAMIENTO ====================
    {
        name: "escalate_to_human",
        description: "Transfiere la conversación a un agente humano. Usar cuando: el cliente lo pide explícitamente, hay un problema que no puedes resolver, o detectas frustración.",
        input_schema: {
            type: "object" as const,
            properties: {
                reason: {
                    type: "string",
                    description: "Motivo del escalamiento"
                },
                priority: {
                    type: "string",
                    description: "'high', 'medium', 'low'"
                }
            },
            required: ["reason"]
        }
    }
]
