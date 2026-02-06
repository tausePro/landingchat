"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/onboarding/progress-bar"
import { createClient } from "@/lib/supabase/client"
import {
    Send,
    Bot,
    User,
    Sparkles,
    ArrowRight,
    Loader2,
    MessageCircle,
    CheckCircle2,
    Rocket
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
}

export default function TestAgentPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [input, setInput] = useState("")
    const [messages, setMessages] = useState<Message[]>([])
    const [organizationName, setOrganizationName] = useState("")
    const [industry, setIndustry] = useState("")
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const supabase = createClient()

    // Initial setup
    useEffect(() => {
        const init = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    router.push("/login")
                    return
                }

                const { data: profile } = await supabase
                    .from("profiles")
                    .select("organization_id")
                    .eq("id", user.id)
                    .single()

                if (!profile?.organization_id) {
                    router.push("/onboarding/business")
                    return
                }

                // Get organization info
                const { data: org } = await supabase
                    .from("organizations")
                    .select("name, industry_slug")
                    .eq("id", profile.organization_id)
                    .single()

                if (org) {
                    setOrganizationName(org.name || "tu negocio")
                    setIndustry(org.industry_slug || "")
                }

                // Add welcome message from agent
                const welcomeMessage = getWelcomeMessage(org?.name, org?.industry_slug)
                setMessages([
                    {
                        id: "welcome",
                        role: "assistant",
                        content: welcomeMessage,
                        timestamp: new Date(),
                    },
                ])
            } catch (error) {
                console.error("Error initializing:", error)
            } finally {
                setLoading(false)
            }
        }

        init()
    }, [router, supabase])

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const getWelcomeMessage = (name?: string, industrySlug?: string): string => {
        const businessName = name || "tu negocio"

        if (industrySlug === "ecommerce") {
            return `¡Hola! 👋 Soy el asistente virtual de ${businessName}. Puedo ayudarte a encontrar productos, resolver dudas sobre envíos y precios, o procesar tu pedido. ¿En qué te puedo ayudar hoy?`
        } else if (industrySlug === "real_estate") {
            return `¡Hola! 👋 Soy el asistente de ${businessName}. Puedo ayudarte a encontrar propiedades según tu presupuesto y ubicación, agendar visitas o resolver cualquier duda sobre el proceso de compra o arriendo. ¿Qué tipo de inmueble buscas?`
        } else {
            return `¡Hola! 👋 Soy el asistente virtual de ${businessName}. Estoy aquí para ayudarte con cualquier consulta. ¿En qué te puedo asistir?`
        }
    }

    const handleSend = async () => {
        if (!input.trim() || sending) return

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        }

        setMessages(prev => [...prev, userMessage])
        setInput("")
        setSending(true)

        try {
            // Simulate agent response (in production, this would call the actual AI)
            await new Promise(resolve => setTimeout(resolve, 1500))

            const response = getSimulatedResponse(input.trim(), industry)

            const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: response,
                timestamp: new Date(),
            }

            setMessages(prev => [...prev, assistantMessage])
        } catch (error) {
            console.error("Error sending message:", error)
        } finally {
            setSending(false)
        }
    }

    const getSimulatedResponse = (userInput: string, industrySlug: string): string => {
        const input = userInput.toLowerCase()

        if (industrySlug === "ecommerce") {
            if (input.includes("precio") || input.includes("cuanto") || input.includes("cuesta")) {
                return "¡Claro! Nuestros precios varían según el producto. ¿Hay algún artículo específico que te interese? Puedo darte información detallada sobre disponibilidad y precio. 💰"
            }
            if (input.includes("envío") || input.includes("envio") || input.includes("entrega")) {
                return "Hacemos envíos a todo el país. 📦 El tiempo de entrega depende de tu ubicación:\n\n• Ciudades principales: 1-3 días hábiles\n• Otras ciudades: 3-5 días hábiles\n\n¿A qué ciudad necesitas el envío?"
            }
            if (input.includes("pago") || input.includes("tarjeta")) {
                return "Aceptamos múltiples formas de pago: 💳\n\n• Tarjetas de crédito y débito\n• Transferencia bancaria\n• Pago contra entrega (ciudades seleccionadas)\n• Cuotas sin interés\n\n¿Quieres que te ayude a procesar una compra?"
            }
            return "¡Entendido! Estoy aquí para ayudarte con cualquier consulta sobre nuestros productos, envíos o pedidos. ¿Hay algo específico en lo que pueda asistirte? 🛍️"
        }

        if (industrySlug === "real_estate") {
            if (input.includes("casa") || input.includes("apartamento") || input.includes("apto")) {
                return "¡Excelente! Tenemos varias opciones disponibles. 🏠 Para ayudarte mejor, cuéntame:\n\n• ¿En qué zona te gustaría?\n• ¿Cuál es tu presupuesto aproximado?\n• ¿Cuántas habitaciones necesitas?\n\nCon esa información puedo mostrarte las mejores opciones."
            }
            if (input.includes("visita") || input.includes("ver") || input.includes("cita")) {
                return "¡Por supuesto! Puedo agendar una visita para ti. 📅\n\n¿Qué día y hora te funcionaría mejor? Tenemos disponibilidad de lunes a sábado de 9am a 6pm."
            }
            if (input.includes("precio") || input.includes("arriendo") || input.includes("venta")) {
                return "Tenemos opciones tanto en venta como en arriendo. 💰 Los precios varían según la zona y características del inmueble.\n\n¿Tienes un presupuesto definido? Así puedo mostrarte opciones que se ajusten a tus necesidades."
            }
            return "¡Entendido! Estoy aquí para ayudarte a encontrar el inmueble ideal. ¿Buscas para comprar o arrendar? 🏢"
        }

        // Generic responses
        if (input.includes("hola") || input.includes("buenos")) {
            return "¡Hola! 👋 ¿En qué te puedo ayudar hoy?"
        }
        if (input.includes("gracias")) {
            return "¡Con gusto! 😊 Si tienes alguna otra pregunta, aquí estaré para ayudarte."
        }

        return "¡Entendido! Déjame verificar esa información y te respondo enseguida. ¿Hay algo más en lo que pueda asistirte mientras tanto? 🤝"
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleFinish = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from("profiles")
                .select("organization_id")
                .eq("id", user.id)
                .single()

            if (profile?.organization_id) {
                // Mark onboarding as completed
                await supabase
                    .from("organizations")
                    .update({
                        onboarding_completed: true,
                        onboarding_step: 3,
                    })
                    .eq("id", profile.organization_id)
            }

            router.push("/dashboard")
        } catch (error) {
            console.error("Error:", error)
            router.push("/dashboard")
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="mt-4 text-slate-500">Preparando tu agente...</p>
            </div>
        )
    }

    return (
        <>
            <ProgressBar currentStep={3} totalSteps={3} stepLabel="Probar tu Agente" />

            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <Sparkles className="size-6 text-yellow-500" />
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        ¡Tu agente está listo!
                    </h1>
                </div>
                <p className="text-base font-normal text-slate-600 dark:text-slate-400">
                    Prueba cómo responderá a tus clientes. Escribe cualquier mensaje.
                </p>
            </div>

            {/* Chat Interface */}
            <div className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-lg">
                {/* Chat Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <div className="size-10 bg-primary rounded-full flex items-center justify-center text-white">
                        <Bot className="size-5" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                            Asistente de {organizationName}
                        </h3>
                        <p className="text-xs text-green-600 flex items-center gap-1">
                            <span className="size-2 bg-green-500 rounded-full" />
                            En línea
                        </p>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[400px]">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={cn(
                                "flex gap-3",
                                message.role === "user" ? "justify-end" : "justify-start"
                            )}
                        >
                            {message.role === "assistant" && (
                                <div className="size-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                                    <Bot className="size-4 text-primary" />
                                </div>
                            )}
                            <div
                                className={cn(
                                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                                    message.role === "user"
                                        ? "bg-primary text-white rounded-br-md"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-md"
                                )}
                            >
                                {message.content}
                            </div>
                            {message.role === "user" && (
                                <div className="size-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center shrink-0">
                                    <User className="size-4 text-slate-600 dark:text-slate-300" />
                                </div>
                            )}
                        </div>
                    ))}
                    {sending && (
                        <div className="flex gap-3 justify-start">
                            <div className="size-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                                <Bot className="size-4 text-primary" />
                            </div>
                            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
                                <div className="flex gap-1">
                                    <span className="size-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                    <span className="size-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                    <span className="size-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-slate-100 dark:border-slate-800 p-3">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe un mensaje..."
                            className="flex-1 px-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            disabled={sending}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || sending}
                            className="size-10 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send className="size-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                    <MessageCircle className="size-4" />
                    Prueba preguntar:
                </h4>
                <div className="flex flex-wrap gap-2">
                    {industry === "ecommerce" && (
                        <>
                            <button
                                onClick={() => setInput("¿Cuánto cuesta el envío?")}
                                className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                            >
                                ¿Cuánto cuesta el envío?
                            </button>
                            <button
                                onClick={() => setInput("¿Qué formas de pago aceptan?")}
                                className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                            >
                                ¿Formas de pago?
                            </button>
                        </>
                    )}
                    {industry === "real_estate" && (
                        <>
                            <button
                                onClick={() => setInput("Busco un apartamento de 2 habitaciones")}
                                className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                            >
                                Busco apartamento
                            </button>
                            <button
                                onClick={() => setInput("Quiero agendar una visita")}
                                className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                            >
                                Agendar visita
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setInput("Hola, necesito información")}
                        className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                    >
                        Información general
                    </button>
                </div>
            </div>

            {/* Finish Button */}
            <div className="flex flex-col items-center gap-4 border-t border-slate-200 pt-6 dark:border-slate-700">
                <Button
                    onClick={handleFinish}
                    className="w-full sm:w-auto h-12 px-8 text-base font-semibold gap-2 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90"
                >
                    <Rocket className="size-4" />
                    Ir al Dashboard
                    <ArrowRight className="size-4" />
                </Button>
                <p className="text-sm text-slate-500 flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-green-500" />
                    Podrás personalizar las respuestas desde el dashboard
                </p>
            </div>
        </>
    )
}
