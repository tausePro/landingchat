"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Bot, CreditCard, MessageSquare, Phone, Power, Puzzle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { updateOrganizationStatus } from "../actions"
import { MODULE_CATALOG } from "./module-catalog"
import {
    updateOrganizationModules,
    updateOrgNotificationPhone,
    type Organization360,
} from "./actions"

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
    active: { label: "Activa", className: "bg-green-100 text-green-800" },
    suspended: { label: "Suspendida", className: "bg-red-100 text-red-800" },
    archived: { label: "Archivada", className: "bg-slate-200 text-slate-600" },
}

export function Org360Client({ initial }: { initial: Organization360 }) {
    const router = useRouter()
    const org = initial
    const [modules, setModules] = useState<string[]>(org.enabled_modules)
    const [phone, setPhone] = useState(org.notification_phone ?? "")
    const [saving, setSaving] = useState<string | null>(null)

    const status = STATUS_BADGE[org.status ?? "active"] ?? STATUS_BADGE.active
    const isSuspended = org.status === "suspended"

    const toggleModule = (id: string) =>
        setModules((prev) => prev.includes(id) ? prev.filter((module) => module !== id) : [...prev, id])

    const handleSaveModules = async () => {
        setSaving("modules")
        try {
            const result = await updateOrganizationModules(org.id, modules)
            if (result.success) {
                toast.success("Módulos actualizados — el tenant los ve al refrescar su dashboard")
                router.refresh()
            } else {
                toast.error(result.error)
            }
        } finally {
            setSaving(null)
        }
    }

    const handleSavePhone = async () => {
        setSaving("phone")
        try {
            const result = await updateOrgNotificationPhone(org.id, phone)
            if (result.success) {
                toast.success("Teléfono de notificaciones guardado")
                router.refresh()
            } else {
                toast.error(result.error)
            }
        } finally {
            setSaving(null)
        }
    }

    const handleToggleSuspension = async () => {
        const next = isSuspended ? "active" : "suspended"
        const message = isSuspended
            ? "¿Reactivar esta organización? Su tienda y chat volverán a estar en línea."
            : "¿SUSPENDER esta organización? Su tienda, chat y APIs públicas quedarán fuera de línea de inmediato."
        if (!confirm(message)) return
        setSaving("status")
        try {
            await updateOrganizationStatus(org.id, next)
            toast.success(next === "suspended" ? "Organización suspendida" : "Organización reactivada")
            router.refresh()
        } catch {
            toast.error("Error al cambiar el estado")
        } finally {
            setSaving(null)
        }
    }

    const groups = [...new Set(MODULE_CATALOG.map((module) => module.group))]

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link href="/admin/organizations" className="text-slate-400 hover:text-slate-600">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            {org.name}
                            <Badge className={status.className}>{status.label}</Badge>
                        </h1>
                        <p className="text-sm text-slate-500">
                            {org.slug} · {org.custom_domain ?? "sin dominio propio"} · {org.locale ?? "es-CO"} · desde {new Date(org.created_at).toLocaleDateString("es-CO")}
                        </p>
                    </div>
                </div>
                <Button
                    variant={isSuspended ? "default" : "destructive"}
                    onClick={handleToggleSuspension}
                    disabled={saving === "status"}
                >
                    <Power className="h-4 w-4 mr-2" />
                    {isSuspended ? "Reactivar" : "Suspender"}
                </Button>
            </div>

            {/* Métricas rápidas */}
            <div className="grid gap-4 sm:grid-cols-4">
                <Card><CardHeader className="pb-1"><CardDescription>Productos</CardDescription><CardTitle>{org.counts.products}</CardTitle></CardHeader></Card>
                <Card><CardHeader className="pb-1"><CardDescription>Pedidos</CardDescription><CardTitle>{org.counts.orders}</CardTitle></CardHeader></Card>
                <Card><CardHeader className="pb-1"><CardDescription>Chats</CardDescription><CardTitle>{org.counts.chats}</CardTitle></CardHeader></Card>
                <Card>
                    <CardHeader className="pb-1">
                        <CardDescription className="flex items-center gap-1"><Bot className="h-3 w-3" /> AI este mes</CardDescription>
                        <CardTitle>${(org.aiUsageMonth.costUsdCents / 100).toFixed(2)}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Módulos */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><Puzzle className="h-4 w-4" /> Módulos y funciones</CardTitle>
                    <CardDescription>Lo que este cliente ve en su dashboard y storefront (ej: Citas/Booking habilita reservas)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {groups.map((group) => (
                        <div key={group}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{group}</p>
                            <div className="grid gap-2 sm:grid-cols-3">
                                {MODULE_CATALOG.filter((module) => module.group === group).map((module) => (
                                    <label key={module.id} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
                                        <Checkbox
                                            checked={modules.includes(module.id)}
                                            onCheckedChange={() => toggleModule(module.id)}
                                        />
                                        {module.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                    <div className="flex justify-end">
                        <Button onClick={handleSaveModules} disabled={saving === "modules"}>
                            {saving === "modules" ? "Guardando..." : "Guardar módulos"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Suscripción */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Suscripción</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                        {org.subscription ? (
                            <>
                                <div className="flex justify-between"><span className="text-slate-500">Plan</span><span className="font-medium">{org.subscription.plan_name ?? "—"}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Estado</span><Badge variant="outline">{org.subscription.status}</Badge></div>
                                <div className="flex justify-between"><span className="text-slate-500">Precio</span><span className="font-mono">${org.subscription.price.toLocaleString("es-CO")} {org.subscription.currency}</span></div>
                                {org.subscription.current_period_end && (
                                    <div className="flex justify-between"><span className="text-slate-500">Renueva</span><span>{new Date(org.subscription.current_period_end).toLocaleDateString("es-CO")}</span></div>
                                )}
                            </>
                        ) : (
                            <p className="text-slate-500">Sin suscripción activa</p>
                        )}
                        <Link href="/admin/subscriptions" className="text-xs text-indigo-600 hover:underline block pt-2">
                            Gestionar plan en Suscripciones →
                        </Link>
                    </CardContent>
                </Card>

                {/* Canales */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Canales</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3">
                        {org.whatsapp.length === 0 ? (
                            <p className="text-slate-500">Sin instancias de WhatsApp</p>
                        ) : (
                            org.whatsapp.map((instance, index) => (
                                <div key={index} className="flex justify-between items-center">
                                    <span className="text-slate-500 capitalize">{instance.instance_type ?? "instancia"}</span>
                                    <span className="flex items-center gap-2">
                                        <span className="font-mono text-xs">{instance.phone_display ?? ""}</span>
                                        <Badge className={instance.status === "connected" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}>
                                            {instance.status ?? "—"}
                                        </Badge>
                                    </span>
                                </div>
                            ))
                        )}
                        <div className="pt-2 border-t space-y-2">
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Phone className="h-3 w-3" /> WhatsApp de notificaciones (fallback platform)
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    value={phone}
                                    onChange={(event) => setPhone(event.target.value)}
                                    placeholder="573001234567"
                                    className="font-mono text-sm"
                                />
                                <Button variant="outline" size="sm" onClick={handleSavePhone} disabled={saving === "phone"}>
                                    {saving === "phone" ? "..." : "Guardar"}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
