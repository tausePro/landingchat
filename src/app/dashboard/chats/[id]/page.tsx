"use client"

import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useChat } from "@/hooks/use-chat"
import { createClient } from "@/lib/supabase/client"

export default function AgentChatPage() {
    const params = useParams()
    const chatId = params.id as string
    const { messages, sendMessage, loading } = useChat(chatId)
    const [inputValue, setInputValue] = useState("")
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const handleSend = async () => {
        if (!inputValue.trim()) return

        // For the agent view, we need to manually specify sender_type as 'agent'
        // The useChat hook defaults to 'user', so we might need to update it or just use direct supabase call here for now
        // For simplicity, let's use the hook but we need to modify the hook to accept senderType or handle it here.
        // Actually, let's just use direct Supabase insert for Agent to ensure correct sender_type

        const supabase = createClient()
        await supabase.from("messages").insert({
            chat_id: chatId,
            sender_type: "agent",
            // sender_id: "CURRENT_AGENT_ID", // We would get this from auth context
            content: inputValue,
        })

        setInputValue("")
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSend()
        }
    }

    return (
        <DashboardLayout>
            <div className="flex flex-col h-[calc(100vh-100px)]">
                <div className="flex items-center justify-between border-b border-border-light dark:border-border-dark pb-4 mb-4">
                    <h1 className="text-xl font-bold text-text-light-primary dark:text-text-dark-primary">
                        Chat #{chatId.slice(0, 8)}
                    </h1>
                    <Button variant="outline" onClick={() => window.history.back()}>
                        Volver
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-border-light dark:border-border-dark">
                    {loading && <div className="text-center text-sm text-gray-500">Cargando conversación...</div>}

                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex items-end gap-3 ${msg.sender_type === "agent" ? "justify-end" : ""
                                }`}
                        >
                            {msg.sender_type !== "agent" && (
                                <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs">
                                    {msg.sender_type === 'bot' ? '🤖' : '👤'}
                                </div>
                            )}

                            <div className={`flex flex-col gap-1 ${msg.sender_type === "agent" ? "items-end" : "items-start"}`}>
                                <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                                    {msg.sender_type === "agent" ? "Tú (Agente)" : msg.sender_type === 'bot' ? 'Bot' : 'Cliente'} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <div
                                    className={`text-sm px-4 py-2 shadow-sm max-w-md ${msg.sender_type === "agent"
                                            ? "rounded-lg rounded-br-none bg-primary text-white"
                                            : "rounded-lg rounded-bl-none bg-white dark:bg-card-dark text-text-light-primary dark:text-text-dark-primary border border-border-light dark:border-border-dark"
                                        }`}
                                >
                                    {msg.content}
                                </div>
                            </div>

                            {msg.sender_type === "agent" && (
                                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                                    👮
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <div className="mt-4 flex gap-2">
                    <Input
                        className="flex-1"
                        placeholder="Escribe una respuesta..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <Button onClick={handleSend}>
                        <span className="material-symbols-outlined mr-2">send</span>
                        Enviar
                    </Button>
                </div>
            </div>
        </DashboardLayout>
    )
}
