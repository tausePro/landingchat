"use client"

import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

export function MaintenanceToggle() {
    const [isActive, setIsActive] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/admin/system-settings")
            const data = await res.json()
            if (data.maintenance_mode) {
                setIsActive(data.maintenance_mode.isActive)
            }
        } catch (error) {
            console.error("Error fetching settings:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleToggle = async (checked: boolean) => {
        setIsActive(checked) // Optimistic update
        try {
            const res = await fetch("/api/admin/system-settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    key: "maintenance_mode",
                    value: {
                        isActive: checked,
                        message: "Estamos en mantenimiento, volvemos pronto."
                    }
                })
            })

            if (!res.ok) throw new Error("Failed to update")

            toast.success(checked ? "Mantenimiento Activado" : "Mantenimiento Desactivado", {
                description: checked
                    ? "La landing page ahora muestra el mensaje de mantenimiento."
                    : "La landing page vuelve a estar visible para todos.",
            })
        } catch (error) {
            setIsActive(!checked) // Revert on error
            toast.error("Error", {
                description: "No se pudo actualizar el estado de mantenimiento."
            })
        }
    }

    if (loading) return <div className="h-6 w-10 bg-slate-200 rounded-full animate-pulse" />

    return (
        <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
                <div className={`size-2 rounded-full ${isActive ? "bg-yellow-500" : "bg-green-500"}`}></div>
                <div className="flex flex-col">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Modo Mantenimiento</span>
                    <span className="text-xs text-slate-500">
                        {isActive ? "Landing page bloqueada" : "Landing page visible"}
                    </span>
                </div>
            </div>
            <Switch
                checked={isActive}
                onCheckedChange={handleToggle}
            />
        </div>
    )
}
