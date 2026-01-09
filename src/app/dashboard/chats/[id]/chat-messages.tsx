"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Message {
    id: string
    content: string
    sender_type: string
    created_at: string
}

interface ChatMessagesProps {
    chatId: string
    initialMessages: Message[]
}

export function ChatMessages({ chatId, initialMessages }: ChatMessagesProps) {
    const [messages, setMessages] = useState<Message[]>(initialMessages)
    const [inputValue, setInputValue] = useState("")
    const [sending, setSending] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel(`chat:${chatId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `chat_id=eq.${chatId}`,
                },
                (payload) => {
                    const newMessage = payload.new as Message
                    setMessages((prev) => {
                        // Evitar duplicados
                        if (prev.some(m => m.id === newMessage.id)) return prev
                        return [...prev, newMessage]
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [chatId])

    const handleSend = async () => {
        if (!inputValue.trim() || sending) return

        setSending(true)
        
        const { error } = await supabase.from("messages").insert({
            chat_id: chatId,
            sender_type: "agent",
            content: inputValue.trim(),
        })

        if (error) {
            console.error("Error sending message:", error)
        }

        setInputValue("")
        setSending(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const getSenderInfo = (senderType: string) => {
        switch (senderType) {
            case 'agent':
                return { label: 'Tú (Agente)', icon: '👮', isAgent: true }
            case 'bot':
                return { label: 'Bot', icon: '🤖', isAgent: false }
            case 'user':
            default:
                return { label: 'Cliente', icon: '👤', isAgent: false }
        }
    }

    return (
        <>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-text-light-secondary dark:text-text-dark-secondary">
                        <p>No hay mensajes en esta conversación</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const sender = getSenderInfo(msg.sender_type)
                        return (
                            <div
                                key={msg.id}
                                className={`flex items-end gap-3 ${sender.isAgent ? "justify-end" : ""}`}
                            >
                                {!sender.isAgent && (
                                    <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm shrink-0">
                                        {sender.icon}
                                    </div>
                                )}

                                <div className={`flex flex-col gap-1 max-w-[70%] ${sender.isAgent ? "items-end" : "items-start"}`}>
                                    <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                        {sender.label} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    <div
                                        className={`text-sm px-4 py-3 shadow-sm whitespace-pre-wrap ${
                                            sender.isAgent
                                                ? "rounded-2xl rounded-br-sm bg-primary text-white"
                                                : msg.sender_type === 'bot'
                                                    ? "rounded-2xl rounded-bl-sm bg-card-light dark:bg-card-dark text-text-light-primary dark:text-text-dark-primary border border-border-light dark:border-border-dark"
                                                    : "rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 text-text-light-primary dark:text-text-dark-primary border border-border-light dark:border-border-dark"
                                        }`}
                                    >
                                        {msg.content}
                                    </div>
                                </div>

                                {sender.isAgent && (
                                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm shrink-0">
                                        {sender.icon}
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark">
                <div className="flex gap-3">
                    <Input
                        className="flex-1"
                        placeholder="Escribe una respuesta como agente..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={sending}
                    />
                    <Button onClick={handleSend} disabled={sending || !inputValue.trim()}>
                        <span className="material-symbols-outlined mr-2">{sending ? 'hourglass_empty' : 'send'}</span>
                        Enviar
                    </Button>
                </div>
                <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-2">
                    Presiona Enter para enviar. Los mensajes se enviarán como agente humano.
                </p>
            </div>
        </>
    )
}
