import { use } from "react"
import { useCartStore } from "@/store/cart-store"
import { CartDrawer } from "../components/cart-drawer"
import { ChatSidebar } from "@/components/chat/chat-sidebar"

export default function ChatLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ slug: string }>
}) {
    const { slug } = use(params)

    return (
        <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark text-text-primary dark:text-gray-200 font-display">
            {/* Main Content */}
            <main className="flex flex-1 overflow-hidden">
                {/* Sidebar (History) */}
                <ChatSidebar slug={slug} />

                {/* Chat Area */}
                <div className="flex flex-col flex-1 bg-background-light dark:bg-background-dark relative">
                    {children}
                </div>
            </main>

            <CartDrawer slug={slug} />
        </div>
    )
}
