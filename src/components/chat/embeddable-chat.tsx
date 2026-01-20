"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useChat } from "@/hooks/use-chat"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const ORGANIZATION_ID = "00000000-0000-0000-0000-000000000001" // Default Seed Org

interface EmbeddableChatProps {
    mode?: "full" | "embedded" | "mobile-focus"
    className?: string
    initialContext?: string
    onClose?: () => void
}

export function EmbeddableChat({
    mode = "full",
    className,
    initialContext
}: EmbeddableChatProps) {
    const [chatId, setChatId] = useState<string | null>(null)
    const { messages, sendMessage, loading } = useChat(chatId || "")
    const [inputValue, setInputValue] = useState("")
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Initialize Chat Session
    useEffect(() => {
        const initChat = async () => {
            const storedChatId = localStorage.getItem("landingchat_session_id")
            if (storedChatId) {
                setChatId(storedChatId)
            } else {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from("chats")
                    .insert({
                        organization_id: ORGANIZATION_ID,
                        status: "active",
                        channel: "web", // Explicitly set channel
                    })
                    .select()
                    .single()

                if (data) {
                    localStorage.setItem("landingchat_session_id", data.id)
                    setChatId(data.id)
                } else if (error) {
                    console.error("Error creating chat:", JSON.stringify(error, null, 2))
                }
            }
        }

        initChat()
    }, [])

    // Send initial context if provided
    useEffect(() => {
        if (chatId && initialContext && messages.length > 0) {
            // Logic to send invisible context or system prompt could go here
            // For now, we assume context handling is done via URL/State before mounting or via hidden message
        }
    }, [chatId, initialContext, messages.length])

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const handleSend = async () => {
        if (!inputValue.trim() || !chatId) return
        await sendMessage(inputValue)
        setInputValue("")
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSend()
        }
    }

    return (
        <div className={cn("flex flex-col h-full bg-white dark:bg-gray-950", className)}>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                {loading && <div className="text-center text-sm text-gray-500">Cargando chat...</div>}

                {!loading && messages.length === 0 && (
                    <div className="text-center text-sm text-gray-500 mt-10 space-y-2">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-2xl">smart_toy</span>
                        </div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">¡Hola! Soy tu asistente de compras.</p>
                        <p>¿En qué puedo ayudarte hoy?</p>
                        {mode === 'embedded' && (
                            <p className="text-xs text-slate-400 max-w-[200px] mx-auto">
                                Haz click en cualquier producto para que pueda asesorarte mejor.
                            </p>
                        )}
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex items-end gap-3 ${msg.sender_type === "user" ? "justify-end" : ""}`}
                    >
                        {msg.sender_type !== "user" && (
                            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-8 h-8 shrink-0 bg-gray-100 flex items-center justify-center text-xs">
                                🤖
                            </div>
                        )}

                        <div className={`flex flex-col gap-1 max-w-[85%] ${msg.sender_type === "user" ? "items-end" : "items-start"}`}>
                            {/* Timestamp optional in compact modes */}
                            {mode === 'full' && (
                                <p className="text-gray-400 text-[10px] px-1">
                                    {msg.sender_type === "user" ? "Tú" : "Asistente"} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            )}
                            <div
                                className={`text-sm md:text-base px-4 py-2.5 shadow-sm ${msg.sender_type === "user"
                                        ? "rounded-2xl rounded-br-sm bg-blue-600 text-white"
                                        : "rounded-2xl rounded-bl-sm bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                    }`}
                            >
                                {msg.content}
                            </div>
                        </div>

                        {msg.sender_type === "user" && (
                            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-8 h-8 shrink-0 bg-gray-200 flex items-center justify-center text-xs">
                                👤
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 md:p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">
                {/* Quick Actions - Only show in full mode or if enough space */}
                {mode === 'full' && (
                    <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                        <Button variant="outline" size="sm" className="rounded-full h-8 text-xs whitespace-nowrap">
                            Ver ofertas
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-full h-8 text-xs whitespace-nowrap">
                            Seguir pedido
                        </Button>
                    </div>
                )}

                <div className="relative">
                    <Input
                        className="h-10 md:h-12 pl-3 md:pl-4 pr-24 bg-gray-50 dark:bg-gray-900 border-transparent focus:ring-1 focus:ring-blue-500 rounded-xl"
                        placeholder="Escribe tu mensaje..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim()}
                            className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="material-symbols-outlined text-lg md:text-xl">send</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
