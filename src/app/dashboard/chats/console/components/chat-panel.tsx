"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { ChatDetailData } from "../../actions"
import type { ActionResult } from "@/types/common"
import {
    Send,
    Smartphone,
    Globe,
    CheckCircle2,
    RotateCcw,
    MessageSquare,
    StickyNote,
    Loader2,
} from "lucide-react"

interface ChatPanelProps {
    chatDetail: ChatDetailData | null
    loading: boolean
    onSendMessage: (content: string, isInternal?: boolean) => Promise<ActionResult<{ messageId: string }> | undefined>
    onStatusChange: (status: "active" | "closed" | "pending") => Promise<ActionResult<void> | undefined>
}

interface Message {
    id: string
    content: string
    sender_type: string
    created_at: string
    metadata?: Record<string, any>
}

function formatMessageTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString("es", {
        hour: "2-digit",
        minute: "2-digit",
    })
}

function formatMessageDate(dateStr: string): string {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return "Hoy"
    if (date.toDateString() === yesterday.toDateString()) return "Ayer"
    return date.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })
}

export function ChatPanel({ chatDetail, loading, onSendMessage, onStatusChange }: ChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState("")
    const [sending, setSending] = useState(false)
    const [isInternalNote, setIsInternalNote] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const supabase = createClient()

    // Actualizar mensajes cuando cambia el chat
    useEffect(() => {
        if (chatDetail?.messages) {
            setMessages(chatDetail.messages)
        } else {
            setMessages([])
        }
    }, [chatDetail?.id, chatDetail?.messages])

    // Auto-scroll al último mensaje
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Realtime subscription
    useEffect(() => {
        if (!chatDetail?.id) return

        const channel = supabase
            .channel(`console-chat:${chatDetail.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `chat_id=eq.${chatDetail.id}`,
                },
                (payload) => {
                    const newMessage = payload.new as Message
                    setMessages((prev) => {
                        if (prev.some((m) => m.id === newMessage.id)) return prev
                        return [...prev, newMessage]
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [chatDetail?.id])

    // Enviar mensaje
    const handleSend = useCallback(async () => {
        if (!inputValue.trim() || sending) return

        setSending(true)
        const content = inputValue.trim()
        setInputValue("")

        await onSendMessage(content, isInternalNote)

        setSending(false)
        setIsInternalNote(false)
        inputRef.current?.focus()
    }, [inputValue, sending, isInternalNote, onSendMessage])

    // Enter para enviar, Shift+Enter para nueva línea
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }, [handleSend])

    // Estado vacío
    if (!chatDetail && !loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50">
                <div className="text-center space-y-3">
                    <div className="size-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center mx-auto">
                        <MessageSquare className="size-8 text-text-light-secondary dark:text-text-dark-secondary" />
                    </div>
                    <div>
                        <p className="text-text-light-primary dark:text-text-dark-primary font-medium">
                            Selecciona una conversación
                        </p>
                        <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
                            Elige un chat de la lista para comenzar a responder
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    // Loading
    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="size-6 animate-spin text-primary" />
            </div>
        )
    }

    // Agrupar mensajes por fecha
    const messagesByDate: { date: string; messages: Message[] }[] = []
    let currentDate = ""
    for (const msg of messages) {
        const dateStr = formatMessageDate(msg.created_at)
        if (dateStr !== currentDate) {
            currentDate = dateStr
            messagesByDate.push({ date: dateStr, messages: [msg] })
        } else {
            messagesByDate[messagesByDate.length - 1].messages.push(msg)
        }
    }

    const isWhatsApp = chatDetail?.channel === "whatsapp"
    const isClosed = chatDetail?.status === "closed"

    return (
        <div className="flex flex-col h-full">
            {/* Header del chat */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-border-light dark:border-border-dark bg-white dark:bg-slate-900 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-medium">
                        {(chatDetail?.customer_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                {chatDetail?.customer_name || "Sin nombre"}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                {isWhatsApp ? (
                                    <><Smartphone className="size-3 text-green-500" /> WhatsApp</>
                                ) : (
                                    <><Globe className="size-3 text-blue-500" /> Web</>
                                )}
                            </span>
                        </div>
                        <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                            {chatDetail?.customer?.phone || ""}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isClosed ? (
                        <button
                            onClick={() => onStatusChange("active")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                        >
                            <RotateCcw className="size-3.5" />
                            Reabrir
                        </button>
                    ) : (
                        <button
                            onClick={() => onStatusChange("closed")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30 transition-colors"
                        >
                            <CheckCircle2 className="size-3.5" />
                            Resolver
                        </button>
                    )}
                </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1 bg-slate-50 dark:bg-slate-900/50">
                {messagesByDate.map((group) => (
                    <div key={group.date}>
                        {/* Separador de fecha */}
                        <div className="flex items-center justify-center my-4">
                            <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow-sm border border-border-light/50 dark:border-border-dark/50">
                                {group.date}
                            </span>
                        </div>

                        {group.messages.map((msg) => {
                            const isAgent = msg.sender_type === "agent"
                            const isBot = msg.sender_type === "bot"
                            const isInternal = msg.metadata?.is_internal === true

                            return (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex mb-2",
                                        isAgent ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div className={cn(
                                        "max-w-[65%] rounded-2xl px-4 py-2.5 shadow-sm",
                                        isInternal
                                            ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-br-sm"
                                            : isAgent
                                                ? "bg-primary text-white rounded-br-sm"
                                                : isBot
                                                    ? "bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-bl-sm"
                                                    : "bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-bl-sm"
                                    )}>
                                        {isInternal && (
                                            <div className="flex items-center gap-1 mb-1">
                                                <StickyNote className="size-3 text-amber-500" />
                                                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Nota interna</span>
                                            </div>
                                        )}
                                        {isBot && (
                                            <p className="text-[10px] font-medium text-text-light-secondary dark:text-text-dark-secondary mb-1">
                                                Bot IA
                                            </p>
                                        )}
                                        <p className={cn(
                                            "text-sm whitespace-pre-wrap break-words",
                                            isInternal
                                                ? "text-amber-900 dark:text-amber-100"
                                                : isAgent
                                                    ? "text-white"
                                                    : "text-text-light-primary dark:text-text-dark-primary"
                                        )}>
                                            {msg.content}
                                        </p>
                                        <p className={cn(
                                            "text-[10px] mt-1",
                                            isAgent && !isInternal
                                                ? "text-white/70"
                                                : "text-text-light-secondary dark:text-text-dark-secondary"
                                        )}>
                                            {formatMessageTime(msg.created_at)}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            {!isClosed ? (
                <div className="border-t border-border-light dark:border-border-dark bg-white dark:bg-slate-900 p-3 flex-shrink-0">
                    {/* Toggle nota interna */}
                    <div className="flex items-center gap-2 mb-2">
                        <button
                            onClick={() => setIsInternalNote(false)}
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                                !isInternalNote
                                    ? "bg-primary/10 text-primary"
                                    : "text-text-light-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800"
                            )}
                        >
                            <Send className="size-3" />
                            Responder
                        </button>
                        <button
                            onClick={() => setIsInternalNote(true)}
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                                isInternalNote
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    : "text-text-light-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800"
                            )}
                        >
                            <StickyNote className="size-3" />
                            Nota interna
                        </button>
                        {isWhatsApp && !isInternalNote && (
                            <span className="text-[10px] text-green-600 dark:text-green-400 ml-auto flex items-center gap-1">
                                <Smartphone className="size-3" />
                                Se enviará por WhatsApp
                            </span>
                        )}
                    </div>

                    <div className="flex items-end gap-2">
                        <textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isInternalNote ? "Escribe una nota interna..." : "Escribe tu mensaje..."}
                            rows={1}
                            className={cn(
                                "flex-1 resize-none rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 border max-h-32",
                                isInternalNote
                                    ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 focus:ring-amber-300 placeholder:text-amber-400"
                                    : "bg-slate-100 dark:bg-slate-800 border-transparent focus:ring-primary/20 placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary"
                            )}
                            disabled={sending}
                            style={{ minHeight: "40px" }}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement
                                target.style.height = "auto"
                                target.style.height = Math.min(target.scrollHeight, 128) + "px"
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={sending || !inputValue.trim()}
                            className={cn(
                                "flex items-center justify-center size-10 rounded-xl transition-colors flex-shrink-0",
                                inputValue.trim()
                                    ? isInternalNote
                                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                                        : "bg-primary hover:bg-primary/90 text-white"
                                    : "bg-slate-200 dark:bg-slate-700 text-text-light-secondary dark:text-text-dark-secondary cursor-not-allowed"
                            )}
                        >
                            {sending ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Send className="size-4" />
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="border-t border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/50 p-4 text-center flex-shrink-0">
                    <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                        Esta conversación está resuelta.{" "}
                        <button
                            onClick={() => onStatusChange("active")}
                            className="text-primary hover:underline font-medium"
                        >
                            Reabrir
                        </button>
                    </p>
                </div>
            )}
        </div>
    )
}
