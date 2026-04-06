"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { ModeToggle } from "@/components/ui/mode-toggle"
import {
    LayoutDashboard,
    BarChart3,
    MessageSquare,
    Package,
    ShoppingCart,
    Users,
    Megaphone,
    Bot,
    Puzzle,
    CreditCard,
    Settings,
    Bell,
    Search,
    LogOut,
    Layers,
    Building2,
    UserPlus,
    Calendar,
    FileText,
    Ticket,
    Truck,
    Tag,
    ImageIcon,
    UserCog,
    Store,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface DashboardLayoutProps {
    children: React.ReactNode
}

// Mapeo de slugs a iconos
const ICON_MAP: Record<string, LucideIcon> = {
    dashboard: LayoutDashboard,
    analytics: BarChart3,
    conversations: MessageSquare,
    chats: MessageSquare,
    products: Package,
    categories: Tag,
    orders: ShoppingCart,
    customers: Users,
    marketing: Megaphone,
    agent: Bot,
    agents: Bot,
    integrations: Puzzle,
    subscription: CreditCard,
    settings: Settings,
    // Inmobiliaria
    properties: Building2,
    leads: UserPlus,
    appointments: Calendar,
    advisors: UserCog,
    documents: FileText,
    // Ecommerce extras
    coupons: Ticket,
    shipping: Truck,
    payments: CreditCard,
    // Media
    media: ImageIcon,
    storefront: Store,
}

interface NavItem {
    slug: string
    label: string
    href: string
    icon: LucideIcon
}

type NavSectionKey = "principal" | "store" | "distribution" | "footer"

interface NavSection {
    key: Exclude<NavSectionKey, "footer">
    label: string
    items: NavItem[]
}

// Items base que siempre aparecen
const BASE_NAV_ITEMS: NavItem[] = [
    { slug: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { slug: "analytics", label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    { slug: "storefront", label: "Storefront", href: "/dashboard/storefront", icon: Store },
]

// Mapeo de módulos a items de navegación
const MODULE_TO_NAV: Record<string, NavItem> = {
    conversations: { slug: "conversations", label: "Chats", href: "/dashboard/chats/console", icon: MessageSquare },
    products: { slug: "products", label: "Productos", href: "/dashboard/products", icon: Package },
    categories: { slug: "categories", label: "Categorías", href: "/dashboard/categories", icon: Tag },
    orders: { slug: "orders", label: "Pedidos", href: "/dashboard/orders", icon: ShoppingCart },
    customers: { slug: "customers", label: "Clientes", href: "/dashboard/customers", icon: Users },
    agent: { slug: "agent", label: "Agente IA", href: "/dashboard/agents", icon: Bot },
    // Inmobiliaria
    properties: { slug: "properties", label: "Propiedades", href: "/dashboard/properties", icon: Building2 },
    leads: { slug: "leads", label: "Leads", href: "/dashboard/leads", icon: UserPlus },
    appointments: { slug: "appointments", label: "Citas", href: "/dashboard/appointments", icon: Calendar },
    advisors: { slug: "advisors", label: "Asesores", href: "/dashboard/settings/advisors", icon: UserCog },
    documents: { slug: "documents", label: "Documentos", href: "/dashboard/documents", icon: FileText },
    // Media
    media: { slug: "media", label: "Media", href: "/dashboard/media", icon: ImageIcon },
    // Ecommerce extras (agrupados en marketing)
    shipping: { slug: "shipping", label: "Envíos", href: "/dashboard/marketing/shipping", icon: Truck },
    coupons: { slug: "coupons", label: "Cupones", href: "/dashboard/marketing/coupons", icon: Ticket },
}

// Items que siempre aparecen al final
const FOOTER_NAV_ITEMS: NavItem[] = [
    { slug: "integrations", label: "Integraciones", href: "/dashboard/integrations", icon: Puzzle },
    { slug: "subscription", label: "Suscripción", href: "/dashboard/subscription", icon: CreditCard },
]

const NAV_SECTION_ORDER: Exclude<NavSectionKey, "footer">[] = ["principal", "store", "distribution"]

const NAV_SECTION_LABELS: Record<Exclude<NavSectionKey, "footer">, string> = {
    principal: "PRINCIPAL",
    store: "TIENDA",
    distribution: "DISTRIBUCIÓN",
}

function getNavSectionKey(item: NavItem): NavSectionKey {
    if (FOOTER_NAV_ITEMS.some((footerItem) => footerItem.slug === item.slug)) {
        return "footer"
    }

    if (["dashboard", "analytics", "conversations", "chats", "agent", "agents", "leads", "appointments", "advisors"].includes(item.slug)) {
        return "principal"
    }

    if (["storefront", "products", "categories", "media", "orders", "customers", "properties", "documents"].includes(item.slug)) {
        return "store"
    }

    if (["marketing", "shipping", "coupons"].includes(item.slug)) {
        return "distribution"
    }

    return "principal"
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const pathname = usePathname()
    const router = useRouter()

    const [isChecking, setIsChecking] = React.useState(true)
    const [userEmail, setUserEmail] = React.useState<string>("")
    const [userAvatar, setUserAvatar] = React.useState<string>("")
    const [userName, setUserName] = React.useState<string>("Admin")
    const [enabledModules, setEnabledModules] = React.useState<string[]>([])
    const [industrySlug, setIndustrySlug] = React.useState<string>("")

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
                        .select("onboarding_completed, enabled_modules, industry")
                        .eq("id", profile.organization_id)
                        .single()

                    if (org) {
                        if (!org.onboarding_completed) {
                            router.push("/onboarding/welcome")
                            return
                        }
                        setEnabledModules(org.enabled_modules || [])
                        setIndustrySlug(org.industry || "")
                    }
                }
            } catch (error) {
                console.error("Error checking onboarding status:", error)
            } finally {
                setIsChecking(false)
            }
        }
        checkOnboarding()
    }, [pathname, router])

    // Construir navegación según módulos habilitados
    const navItems = React.useMemo(() => {
        const items: NavItem[] = [...BASE_NAV_ITEMS]

        // Si no hay módulos configurados, mostrar menú por defecto (ecommerce)
        const modules = enabledModules.length > 0
            ? enabledModules
            : ["conversations", "products", "orders", "customers", "agent"]

        // Detectar si es vertical inmobiliaria
        const isRealEstate = modules.includes("properties") || modules.includes("appointments") || modules.includes("leads")

        // Agregar items según módulos habilitados
        for (const mod of modules) {
            // Ocultar "Clientes" en real estate (Leads lo reemplaza)
            if (mod === "customers" && isRealEstate) continue

            if (MODULE_TO_NAV[mod]) {
                items.push(MODULE_TO_NAV[mod])
                // Categorías y Media aparecen automáticamente con productos
                if (mod === "products") {
                    if (MODULE_TO_NAV["categories"]) items.push(MODULE_TO_NAV["categories"])
                    if (MODULE_TO_NAV["media"]) items.push(MODULE_TO_NAV["media"])
                }
            }
        }

        // Asesores aparece automáticamente con la vertical inmobiliaria
        if (isRealEstate && !modules.includes("advisors")) {
            items.push(MODULE_TO_NAV["advisors"])
        }

        // Marketing solo si hay módulos de marketing habilitados
        const hasMarketing = modules.includes("coupons") || modules.includes("shipping")
        if (hasMarketing) {
            items.push({ slug: "marketing", label: "Marketing", href: "/dashboard/marketing", icon: Megaphone })
        }

        // Agregar items del footer
        items.push(...FOOTER_NAV_ITEMS)

        return items
    }, [enabledModules])

    const { navSections, footerItems } = React.useMemo(() => {
        const sections: Record<Exclude<NavSectionKey, "footer">, NavItem[]> = {
            principal: [],
            store: [],
            distribution: [],
        }
        const footerItems: NavItem[] = []

        for (const item of navItems) {
            const sectionKey = getNavSectionKey(item)

            if (sectionKey === "footer") {
                footerItems.push(item)
                continue
            }

            sections[sectionKey].push(item)
        }

        const navSections: NavSection[] = NAV_SECTION_ORDER
            .map((key) => ({ key, label: NAV_SECTION_LABELS[key], items: sections[key] }))
            .filter((section) => section.items.length > 0)

        return { navSections, footerItems }
    }, [navItems])

    const renderNavItem = (item: NavItem) => {
        const Icon = item.icon
        const isActive = pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href))

        return (
            <Link
                key={item.href}
                href={item.href}
                className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                    isActive
                        ? "bg-primary/10 text-primary font-medium shadow-sm"
                        : "text-text-light-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary"
                )}
            >
                <Icon className="size-5" />
                <p className="text-sm">{item.label}</p>
            </Link>
        )
    }

    return (
        <div className="relative flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
            {/* Sidebar */}
            <aside className="flex w-64 flex-col border-r border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-4 hidden md:flex">
                <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 transition-transform hover:scale-[1.02]">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-landing-deep text-white shadow-md">
                        <Layers className="size-5" />
                    </div>
                    <h2 className="text-text-light-primary dark:text-text-dark-primary text-xl font-bold">
                        LandingChat
                    </h2>
                </Link>

                <div className="flex min-h-0 flex-1 flex-col justify-between mt-8">
                    <nav className="flex flex-col gap-6 overflow-y-auto min-h-0 pb-4">
                        {navSections.map((section) => (
                            <div key={section.key} className="space-y-2">
                                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-light-secondary/80 dark:text-text-dark-secondary/80">
                                    {section.label}
                                </p>
                                <div className="flex flex-col gap-1">
                                    {section.items.map((item) => renderNavItem(item))}
                                </div>
                            </div>
                        ))}
                        {footerItems.length > 0 && (
                            <div className="space-y-2 border-t border-border-light pt-4 dark:border-border-dark">
                                <div className="flex flex-col gap-1">
                                    {footerItems.map((item) => renderNavItem(item))}
                                </div>
                            </div>
                        )}
                    </nav>

                    <div className="flex shrink-0 flex-col gap-4 pt-4 border-t border-border-light dark:border-border-dark">
                        <div className="flex gap-3 items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            {userAvatar ? (
                                <div
                                    className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 ring-2 ring-white dark:ring-slate-700"
                                    style={{ backgroundImage: `url("${userAvatar}")` }}
                                />
                            ) : (
                                <div className="bg-gradient-to-br from-primary to-violet-600 rounded-full size-10 flex items-center justify-center ring-2 ring-white dark:ring-slate-700">
                                    <span className="text-white font-bold text-lg">
                                        {userName.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <div className="flex flex-col min-w-0">
                                <h1 className="text-text-light-primary dark:text-text-dark-primary text-sm font-medium leading-tight truncate">
                                    {userName}
                                </h1>
                                <p className="text-text-light-secondary dark:text-text-dark-secondary text-xs font-normal truncate">
                                    {userEmail}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={async () => {
                                const supabase = createClient()
                                await supabase.auth.signOut()
                                window.location.href = "/login"
                            }}
                            className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                            <LogOut className="size-4" />
                            <span>Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="sticky top-0 z-10 flex h-16 items-center justify-between whitespace-nowrap border-b border-border-light dark:border-border-dark bg-card-light/80 dark:bg-card-dark/80 backdrop-blur-sm px-8 shrink-0">
                    <label className="relative flex items-center min-w-40 max-w-sm w-full">
                        <Search className="absolute left-3 size-4 text-text-light-secondary dark:text-text-dark-secondary" />
                        <input
                            className="w-full rounded-xl bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary/20 border border-slate-200 dark:border-slate-700 h-10 placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary pl-10 text-sm font-normal"
                            placeholder="Buscar..."
                        />
                    </label>
                    <div className="flex items-center gap-3">
                        <ModeToggle />
                        <button className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-background-light dark:bg-background-dark border border-slate-200 dark:border-slate-700 text-text-light-secondary dark:text-text-dark-secondary hover:text-primary transition-colors">
                            <Bell className="size-5" />
                        </button>
                        <Link
                            href="/dashboard/settings"
                            className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-background-light dark:bg-background-dark border border-slate-200 dark:border-slate-700 text-text-light-secondary dark:text-text-dark-secondary hover:text-primary transition-colors"
                        >
                            <Settings className="size-5" />
                        </Link>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-8">{children}</div>
            </main>
        </div>
    )
}
