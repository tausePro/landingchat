"use client"

import { ChatLayout } from "@/components/layout/chat-layout"
import { EmbeddableChat } from "@/components/chat/embeddable-chat"

export default function ChatPage() {
  return (
    <ChatLayout>
      <EmbeddableChat mode="full" className="w-full h-full" />
    </ChatLayout>
  )
}
