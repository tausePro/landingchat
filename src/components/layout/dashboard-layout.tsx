"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { ModeToggle } from "@/components/ui/mode-toggle"

interface DashboardLayoutProps {
    children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const pathname = usePathname()
    const router = useRouter()

    const [isChecking, setIsChecking] = React.useState(true)
    const [userEmail, setUserEmail] = React.useState<string>("")
    const [userAvatar, setUserAvatar] = React.useState<string>("")
    const [userName, setUserName] = React.useState<string>("Admin")

    React.useEffect(() => {
        const checkOnboarding = async () => {
            try {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                // Set user data from auth
                setUserEmail(user.email || "")
                setUserAvatar(user.user_metadata?.avatar_url || "")
                setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || "Admin")

                const { data: profile } = await supabase
                    .from("profiles")
                    .select("organization_id")
                    .eq("id", user.id)
                    .single()

                if (profile?.organization_id) {
                    const { data: org } = await supabase
                        .from("organizations")
                        .select("onboarding_completed")
                        .eq("id", profile.organization_id)
                        .single()

                    if (org && !org.onboarding_completed) {
                        router.push("/onboarding")
                        return
                    }
                }
            } catch (error) {
                console.error("Error checking onboarding status:", error)
            } finally {
                setIsChecking(false)
            }
        }
        checkOnboarding()
    }, [pathname])

    const navItems = [
        { icon: "dashboard", label: "Dashboard", href: "/dashboard" },
        { icon: "trending_up", label: "Ventas", href: "/dashboard/sales" },
        { icon: "chat", label: "Chats", href: "/dashboard/chats" },
        { icon: "inventory_2", label: "Productos", href: "/dashboard/products" },
        { icon: "receipt_long", label: "Pedidos", href: "/dashboard/orders" },
        { icon: "group", label: "Clientes", href: "/dashboard/customers" },
        { icon: "campaign", label: "Marketing", href: "/dashboard/marketing" },
        { icon: "smart_toy", label: "Agentes", href: "/dashboard/agents" },
    ]

    return (
        <div className="relative flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
            {/* Sidebar */}
            <aside className="flex w-64 flex-col border-r border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-4 hidden md:flex">
                <div className="flex items-center gap-3 px-3 py-2">
                    <div className="text-primary size-8">
                        <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path
                                clipRule="evenodd"
                                d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z"
                                fill="currentColor"
                                fillRule="evenodd"
                            ></path>
                        </svg>
                    </div>
                    <h2 className="text-text-light-primary dark:text-text-dark-primary text-xl font-bold">
                        LandingChat
                    </h2>
                </div>

                <div className="flex h-full flex-col justify-between mt-8">
                    <nav className="flex flex-col gap-2">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                                        isActive
                                            ? "bg-primary/20 text-primary"
                                            : "text-text-light-secondary dark:text-text-dark-secondary hover:bg-primary/10 hover:text-primary"
                                    )}
                                >
                                    <span className="material-symbols-outlined text-2xl">
                                        {item.icon}
                                    </span>
                                    <p className="text-sm font-medium">{item.label}</p>
                                </Link>
                            )
                        })}
                    </nav>

                    <div className="flex flex-col gap-4">
                        <div className="flex gap-3 items-center">
                            {userAvatar ? (
                                <div
                                    className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10"
                                    style={{ backgroundImage: `url("${userAvatar}")` }}
                                ></div>
                            ) : (
                                <div className="bg-primary/20 rounded-full size-10 flex items-center justify-center">
                                    <span className="text-primary font-bold text-lg">
                                        {userName.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <div className="flex flex-col">
                                <h1 className="text-text-light-primary dark:text-text-dark-primary text-base font-medium leading-normal">
                                    {userName}
                                </h1>
                                <p className="text-text-light-secondary dark:text-text-dark-secondary text-sm font-normal leading-normal">
                                    {userEmail}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={async () => {
                                const supabase = createClient()
                                await supabase.auth.signOut()
                                window.location.href = "/auth"
                            }}
                            className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors pl-1"
                        >
                            <span className="material-symbols-outlined text-lg">logout</span>
                            <span>Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="sticky top-0 z-10 flex h-16 items-center justify-between whitespace-nowrap border-b border-border-light dark:border-border-dark bg-card-light/80 dark:bg-card-dark/80 backdrop-blur-sm px-8 shrink-0">
                    <label className="relative flex items-center min-w-40 max-w-sm w-full">
                        <span className="material-symbols-outlined absolute left-3 text-text-light-secondary dark:text-text-dark-secondary">
                            search
                        </span>
                        <input
                            className="w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent h-10 placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary pl-10 text-sm font-normal"
                            placeholder="Buscar pedidos, productos, clientes..."
                        />
                    </label>
                    <div className="flex items-center gap-4">
                        <ModeToggle />
                        <button className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-background-light dark:bg-background-dark text-text-light-secondary dark:text-text-dark-secondary hover:text-primary">
                            <span className="material-symbols-outlined text-2xl">
                                notifications
                            </span>
                        </button>
                        <Link href="/dashboard/settings" className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-background-light dark:bg-background-dark text-text-light-secondary dark:text-text-dark-secondary hover:text-primary">
                            <span className="material-symbols-outlined text-2xl">
                                settings
                            </span>
                        </Link>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-8">{children}</div>
            </main>
        </div>
    )
}
