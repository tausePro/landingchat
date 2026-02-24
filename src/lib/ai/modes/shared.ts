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
                }
            },
            required: ["title", "proposed_date", "customer_name"]
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
