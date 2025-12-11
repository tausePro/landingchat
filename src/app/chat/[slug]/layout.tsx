"use client"

import { use } from "react"
import { useCartStore } from "@/store/cart-store"
import { CartDrawer } from "../components/cart-drawer"

export default function ChatLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ slug: string }>
}) {
    const { slug } = use(params)
    const { toggleCart, items } = useCartStore()

    return (
        <>
            {children}
            <CartDrawer slug={slug} />
        </>
    )
}
