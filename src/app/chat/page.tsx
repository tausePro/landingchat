"use client"

import { useEffect, useState, useRef } from "react"
import { ChatLayout } from "@/components/layout/chat-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useChat } from "@/hooks/use-chat"
import { createClient } from "@/lib/supabase/client"

const ORGANIZATION_ID = "00000000-0000-0000-0000-000000000001" // Default Seed Org

export default function ChatPage() {
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
    <ChatLayout>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading && <div className="text-center text-sm text-gray-500">Cargando chat...</div>}

        {!loading && messages.length === 0 && (
          <div className="text-center text-sm text-gray-500 mt-10">
            <p>¡Hola! Soy tu asistente de compras.</p>
            <p>¿En qué puedo ayudarte hoy?</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-end gap-3 ${msg.sender_type === "user" ? "justify-end" : ""
              }`}
          >
            {msg.sender_type !== "user" && (
              <div
                className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-10 shrink-0"
                style={{
                  backgroundImage:
                    'url("https://lh3.googleusercontent.com/aida-public/AB6AXuANUbs7QMP-UuEesdAeBn8-dAS0paLvl9fh8hFd7XQ0syzoFqVp9PBwX76XPR6Dd1F0Rz-qKHKGELRXY8yM_67rZ3MMyR9geogbdOx1wxOPFLAY9Pl90UtBf141PqA0kQwv6e_KlOwkVqwPttocD_KEaVhDGHVgOjRKo00KS2ynCfN8CTWBmptoOciWiZgp_FcIcTLdIFpOyhfKfuJiZtDw8_X4Rumcfmf9I24oRKRlvZG4AWfePuuIBoNot8JobtAZmM2CHwrOKW0")',
                }}
              ></div>
            )}

            <div className={`flex flex-col gap-1 ${msg.sender_type === "user" ? "items-end" : "items-start"}`}>
              <p className="text-text-light-secondary dark:text-text-dark-secondary text-[13px] font-normal leading-normal max-w-full">
                {msg.sender_type === "user" ? "Tú" : "Asistente"} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <div
                className={`text-base font-normal leading-normal flex max-w-lg px-4 py-3 shadow-sm ${msg.sender_type === "user"
                  ? "rounded-lg rounded-br-none bg-primary text-white"
                  : "rounded-lg rounded-bl-none bg-card-light dark:bg-card-dark text-text-light-primary dark:text-text-dark-primary border border-border-light dark:border-border-dark"
                  }`}
              >
                {msg.content}
              </div>
            </div>

            {msg.sender_type === "user" && (
              <div
                className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-10 shrink-0"
                style={{
                  backgroundImage:
                    'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBez3Wh3agYQeBwWeASILSTqaBe3tIarckNMJm5uni28U-Z11srs7519cWP45jUQlvdS8FggmImC-hpa8LgZYTE3ddw_g_z3kCP6PmZ82eE5XB3cKus1H45UFA__-6UdPiJ-NyVy2qMGq4RHtS7q0WiOM2_35U0Spgx9E8eI2c6zKEkVct9XymP0Jc33bq5dBbihPgeWUAInDNMwC7GDXkCqoWhsIlFCIQdyCtc3UISdbxxjq2JPQjGPN4XOz0FhLZ8w269JN6Z-dk")',
                }}
              ></div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Footer */}
      <div className="p-4 border-t border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="outline" size="sm" className="rounded-full h-8">
            Ver ofertas
          </Button>
          <Button variant="outline" size="sm" className="rounded-full h-8">
            Seguir mi pedido
          </Button>
          <Button variant="outline" size="sm" className="rounded-full h-8">
            ¿Necesitas ayuda?
          </Button>
        </div>
        <div className="relative">
          <Input
            className="h-12 pl-4 pr-28 bg-background-light dark:bg-background-dark border-transparent focus:ring-2 focus:ring-primary"
            placeholder="Escribe tu mensaje aquí..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button className="flex items-center justify-center size-9 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-text-light-secondary dark:text-text-dark-secondary transition-colors">
              <span className="material-symbols-outlined text-xl">add</span>
            </button>
            <button
              onClick={handleSend}
              className="flex items-center justify-center size-9 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">send</span>
            </button>
          </div>
        </div>
      </div>
    </ChatLayout>
  )
}

