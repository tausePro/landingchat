"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MessageCircle, X, Minimize2, Send, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, getContrastTextColor } from "@/lib/utils"
import { getStoredUUID, setStoredUUID, getStoredString } from "@/lib/utils/storage"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ChatMessage {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
}

interface StorefrontChatPanelProps {
    slug: string
    organizationName: string
    primaryColor: string
    /** Cuando se pide abrir el chat desde un CTA externo */
    externalOpen?: boolean
    /** Producto pendiente para contextualizar */
    pendingProductId?: string | null
    pendingContext?: string | null
    /** Callback para limpiar pendientes después de procesarlos */
    onPendingConsumed?: () => void
    /** Callback cuando el panel necesita identificar al usuario primero */
    onNeedIdentification?: (productId?: string, context?: string) => void
    className?: string
}

type PanelState = "bubble" | "open"

// ─── Componente ──────────────────────────────────────────────────────────────

export function StorefrontChatPanel({
    slug,
    organizationName,
    primaryColor,
    externalOpen = false,
    pendingProductId,
    pendingContext,
    onPendingConsumed,
    onNeedIdentification,
    className,
}: StorefrontChatPanelProps) {
    const [panelState, setPanelState] = useState<PanelState>("bubble")
    const [chatId, setChatId] = useState<string | null>(null)
    const [agentName, setAgentName] = useState("Asistente")
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isInitializing, setIsInitializing] = useState(false)
    const [hasUnread, setHasUnread] = useState(false)
    const [initError, setInitError] = useState<string | null>(null)
    const [customerName, setCustomerName] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const initRef = useRef(false)
    const processedProductRef = useRef<string | null>(null)

    // Leer nombre del cliente de localStorage al montar
    useEffect(() => {
        const storedName = getStoredString(`customer_name_${slug}`)
        if (storedName) setCustomerName(storedName)
    }, [slug])

    // Scroll al fondo cuando llegan mensajes
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Abrir panel desde CTAs externos
    useEffect(() => {
        if (externalOpen && panelState === "bubble") {
            openPanel()
        }
    }, [externalOpen])

    // ─── Inicialización del chat ─────────────────────────────────────────────

    const initializeChat = useCallback(async () => {
        const customerId = getStoredUUID(`customer_${slug}`)
        if (!customerId) {
            // No identificado → delegar al gate modal
            onNeedIdentification?.(pendingProductId ?? undefined, pendingContext ?? undefined)
            return
        }

        setIsInitializing(true)

        // Intentar retomar chat existente
        const existingChatId = getStoredUUID(`chatId_${slug}`)
        if (existingChatId) {
            const loaded = await fetchHistory(existingChatId)
            if (loaded) {
                setChatId(existingChatId)
                setIsInitializing(false)
                await processProductContext(existingChatId, customerId)
                return
            }
            // Chat inválido, limpiar
            try { localStorage.removeItem(`chatId_${slug}`) } catch { /* ignore */ }
        }

        // Crear chat nuevo
        try {
            const response = await fetch(`/api/store/${slug}/chat/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerId }),
            })

            if (!response.ok) {
                if (response.status === 404) {
                    // Cliente eliminado
                    try {
                        localStorage.removeItem(`customer_${slug}`)
                        localStorage.removeItem(`customer_name_${slug}`)
                        localStorage.removeItem(`chatId_${slug}`)
                    } catch { /* ignore */ }
                    onNeedIdentification?.()
                    setIsInitializing(false)
                    return
                }
                throw new Error(`Failed to init chat: ${response.status}`)
            }

            const data = await response.json()
            if (data.chatId) {
                setChatId(data.chatId)
                setStoredUUID(`chatId_${slug}`, data.chatId)
                if (data.agent?.name) setAgentName(data.agent.name)

                // Usar el greeting del init directamente (no depender solo de fetchHistory)
                if (data.greeting) {
                    const greetingMsg: ChatMessage = {
                        id: `greeting-${data.chatId}`,
                        role: "assistant",
                        content: data.greeting,
                        timestamp: new Date(),
                    }
                    setMessages([greetingMsg])
                }

                // Intentar cargar historial completo (puede sobrescribir el greeting si hay más mensajes)
                const historyLoaded = await fetchHistory(data.chatId)
                if (!historyLoaded && !data.greeting) {
                    console.warn("No se pudo cargar historial ni greeting")
                }

                await processProductContext(data.chatId, customerId)
            } else {
                setInitError("No se pudo crear la conversación.")
            }
        } catch (error) {
            console.error("Error initializing inline chat:", error)
            setInitError("Error al conectar. Intenta de nuevo.")
        } finally {
            setIsInitializing(false)
        }
    }, [slug, pendingProductId, pendingContext])

    // ─── Historial ───────────────────────────────────────────────────────────

    const fetchHistory = async (id: string): Promise<boolean> => {
        try {
            const res = await fetch(`/api/store/${slug}/chat/${id}/messages`)
            if (!res.ok) return false
            const data = await res.json()
            if (data.messages) {
                setMessages(
                    data.messages.map((m: any) => ({
                        ...m,
                        timestamp: new Date(m.timestamp),
                    }))
                )
                return true
            }
            return false
        } catch {
            return false
        }
    }

    // ─── Contexto de producto ────────────────────────────────────────────────

    const processProductContext = async (currentChatId: string, customerId: string) => {
        const productId = pendingProductId
        const context = pendingContext

        if (!productId || processedProductRef.current === productId) {
            onPendingConsumed?.()
            return
        }

        processedProductRef.current = productId
        onPendingConsumed?.()
        setIsLoading(true)

        try {
            const contextMessage = context
                ? `Hola, me interesa este producto: ${decodeURIComponent(context)}`
                : "Hola, me interesa este producto"

            const response = await fetch("/api/ai-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: contextMessage,
                    chatId: currentChatId,
                    slug,
                    customerId,
                    currentProductId: productId,
                    context: context ? decodeURIComponent(context) : undefined,
                }),
            })

            if (response.ok) {
                const data = await response.json()
                const aiMsg: ChatMessage = {
                    id: `ai-ctx-${Date.now()}`,
                    role: "assistant",
                    content: data.message,
                    timestamp: new Date(),
                }
                setMessages((prev) => [...prev, aiMsg])
            }
        } catch (error) {
            console.error("Error sending product context:", error)
        } finally {
            setIsLoading(false)
        }
    }

    // ─── Enviar mensaje ──────────────────────────────────────────────────────

    const handleSend = async () => {
        const text = input.trim()
        if (!text || isLoading || !chatId) return

        const customerId = getStoredUUID(`customer_${slug}`)
        if (!customerId) return

        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: text,
            timestamp: new Date(),
        }
        setMessages((prev) => [...prev, userMsg])
        setInput("")
        setIsLoading(true)

        try {
            const response = await fetch("/api/ai-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: text,
                    chatId,
                    slug,
                    customerId,
                }),
            })

            if (!response.ok) throw new Error("AI response failed")

            const data = await response.json()
            const aiMsg: ChatMessage = {
                id: `ai-${Date.now()}`,
                role: "assistant",
                content: data.message,
                timestamp: new Date(),
            }
            setMessages((prev) => [...prev, aiMsg])
        } catch {
            const errorMsg: ChatMessage = {
                id: `err-${Date.now()}`,
                role: "assistant",
                content: "Lo siento, tuve un problema. ¿Podrías intentarlo de nuevo?",
                timestamp: new Date(),
            }
            setMessages((prev) => [...prev, errorMsg])
        } finally {
            setIsLoading(false)
        }
    }

    // ─── Abrir / cerrar ──────────────────────────────────────────────────────

    const openPanel = () => {
        setPanelState("open")
        setHasUnread(false)

        if (!initRef.current) {
            initRef.current = true
            initializeChat()
        }

        // Focus input después del render
        setTimeout(() => inputRef.current?.focus(), 300)
    }

    const minimizePanel = () => {
        setPanelState("bubble")
    }

    // ─── Render: Burbuja ─────────────────────────────────────────────────────

    if (panelState === "bubble") {
        return (
            <div className={cn("fixed bottom-6 right-6 z-50", className)}>
                <button
                    onClick={openPanel}
                    className="group relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300"
                    style={{ backgroundColor: primaryColor }}
                    aria-label="Abrir chat"
                >
                    <MessageCircle className="h-6 w-6 transition-transform group-hover:scale-110" />

                    {hasUnread && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500" />
                        </span>
                    )}
                </button>

                {/* Tooltip proactivo personalizado */}
                <div className="absolute bottom-full right-0 mb-3 hidden animate-bounce-slow md:block">
                    <div className="rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-lg ring-1 ring-slate-200/60">
                        {customerName
                            ? `¡Hola ${customerName.split(" ")[0]}! 👋 ¿Te ayudo?`
                            : "💬 ¿Necesitas ayuda?"
                        }
                        <div className="absolute -bottom-1 right-5 h-2 w-2 rotate-45 bg-white ring-1 ring-slate-200/60 ring-t-0 ring-l-0" />
                    </div>
                </div>
            </div>
        )
    }

    // ─── Render: Panel abierto ───────────────────────────────────────────────

    return (
        <div className={cn(
            "fixed bottom-0 right-0 z-50 flex flex-col",
            // Mobile: pantalla completa
            "h-full w-full",
            // Desktop: panel lateral
            "md:bottom-6 md:right-6 md:h-[min(680px,calc(100vh-48px))] md:w-[400px] md:rounded-2xl",
            "overflow-hidden border border-slate-200/80 bg-white shadow-2xl",
            className
        )}>
            {/* Header */}
            <div
                className="flex shrink-0 items-center justify-between px-4 py-3"
                style={{ backgroundColor: primaryColor }}
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white">
                        <MessageCircle className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold" style={{ color: getContrastTextColor(primaryColor) }}>
                            {agentName}
                        </p>
                        <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-[10px] font-medium" style={{ color: getContrastTextColor(primaryColor), opacity: 0.85 }}>
                                En línea
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={minimizePanel}
                        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/20"
                        style={{ color: getContrastTextColor(primaryColor) }}
                        aria-label="Minimizar chat"
                    >
                        <Minimize2 className="h-4 w-4" />
                    </button>
                    <button
                        onClick={minimizePanel}
                        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/20"
                        style={{ color: getContrastTextColor(primaryColor) }}
                        aria-label="Cerrar chat"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50">
                {isInitializing && (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                            <p className="mt-2 text-xs text-slate-500">Conectando con {agentName}...</p>
                        </div>
                    </div>
                )}

                {!isInitializing && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div
                            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${primaryColor}18` }}
                        >
                            <MessageCircle className="h-7 w-7" style={{ color: primaryColor }} />
                        </div>
                        <p className="text-sm font-semibold text-slate-900">¡Hola! Soy {agentName}</p>
                        <p className="mt-1 text-xs text-slate-500">¿En qué puedo ayudarte hoy?</p>
                        {initError && (
                            <button
                                onClick={() => {
                                    setInitError(null)
                                    initRef.current = false
                                    initializeChat()
                                }}
                                className="mt-3 rounded-lg px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
                                style={{ backgroundColor: primaryColor }}
                            >
                                Reintentar conexión
                            </button>
                        )}
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={cn(
                            "flex gap-2",
                            msg.role === "user" ? "justify-end" : "justify-start"
                        )}
                    >
                        <div
                            className={cn(
                                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                                msg.role === "user"
                                    ? "rounded-br-sm text-white"
                                    : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"
                            )}
                            style={msg.role === "user" ? { backgroundColor: primaryColor } : undefined}
                        >
                            {msg.role === "user" ? (
                                msg.content
                            ) : (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                                        a: ({ children, href }) => (
                                            <a href={href} target="_blank" rel="noopener noreferrer" className="underline font-medium" style={{ color: primaryColor }}>
                                                {children}
                                            </a>
                                        ),
                                        ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                                        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                                    }}
                                />
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
                            <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-3">
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                handleSend()
                            }
                        }}
                        placeholder="Escribe tu mensaje..."
                        disabled={isInitializing || !chatId}
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-1 focus:ring-slate-300 disabled:opacity-50"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading || !chatId}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ backgroundColor: primaryColor }}
                        aria-label="Enviar mensaje"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </div>
                <p className="mt-1.5 text-center text-[10px] text-slate-400">
                    Powered by LandingChat
                </p>
            </div>
        </div>
    )
}
