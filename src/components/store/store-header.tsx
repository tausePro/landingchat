"use client"

import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"

interface StoreHeaderProps {
    slug: string
    organization: any
    onStartChat: () => void
    hideOnMobile?: boolean
    primaryColor: string
    showStoreName?: boolean
    className?: string
    hideChatButton?: boolean
}

export function StoreHeader({
    slug,
    organization,
    onStartChat,
    hideOnMobile = false,
    primaryColor,
    showStoreName = true,
    className = "",
    hideChatButton = false
}: StoreHeaderProps) {
    const router = useRouter()

    const pathname = usePathname()
    // Si no empieza con /store/, asumimos que estamos en un subdominio o dominio custom
    const isSubdomain = !pathname?.startsWith('/store/')

    const homeLink = isSubdomain ? '/' : `/store/${slug}`
    const productsLink = isSubdomain ? '/productos' : `/store/${slug}/productos`

    return (
        <header className={`sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md ${hideOnMobile ? 'hidden md:block' : ''} ${className}`}>
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push(homeLink)}>
                    {organization.logo_url ? (
                        <img
                            src={organization.logo_url}
                            alt={organization.name}
                            className="h-10 w-auto object-contain max-w-[120px] md:max-w-[150px]"
                        />
                    ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white font-bold text-lg">
                            {organization.name.substring(0, 1)}
                        </div>
                    )}
                    {showStoreName && (
                        <span className="text-lg md:text-xl font-bold tracking-tight">{organization.name}</span>
                    )}
                </div>
                <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
                    <a href={homeLink} className="hover:text-primary transition-colors">Inicio</a>
                    <a href={productsLink} className="hover:text-primary transition-colors">Productos</a>
                </nav>
                <div className="flex items-center gap-4">
                    {!hideChatButton && (
                        <Button
                            onClick={onStartChat}
                            style={{ backgroundColor: primaryColor }}
                            className="font-bold shadow-lg shadow-blue-500/20 text-sm md:text-base px-4 md:px-6"
                        >
                            Iniciar Chat
                        </Button>
                    )}
                </div>
            </div>
        </header>
    )
}
