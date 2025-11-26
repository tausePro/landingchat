import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { RealtimeChannel } from "@supabase/supabase-js"

export type Message = {
    id: string
    chat_id: string
    sender_type: "user" | "bot" | "agent"
    content: string
    created_at: string
}

export function useChat(chatId: string) {
    const [messages, setMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        if (!chatId) return

        const fetchMessages = async () => {
            const { data, error } = await supabase
                .from("messages")
                .select("*")
                .eq("chat_id", chatId)
                .order("created_at", { ascending: true })

            if (error) {
                console.error("Error fetching messages:", error)
            } else {
                setMessages(data || [])
            }
            setLoading(false)
        }

        fetchMessages()

        // Realtime Subscription
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
                    setMessages((prev) => [...prev, newMessage])
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [chatId])

    const sendMessage = async (content: string) => {
        if (!content.trim()) return

        setSending(true)
        // Optimistic update (optional, but good for UX)
        // const tempId = Math.random().toString()
        // setMessages((prev) => [...prev, { id: tempId, chat_id: chatId, sender_type: 'user', content, created_at: new Date().toISOString() }])

        const { error } = await supabase.from("messages").insert({
            chat_id: chatId,
            sender_type: "user",
            content,
        })

        if (error) {
            console.error("Error sending message:", error)
            // Revert optimistic update if needed
        }

        setSending(false)
    }

    return {
        messages,
        loading,
        sending,
        sendMessage,
    }
}
