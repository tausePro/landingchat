"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2, CheckCircle2, XCircle, Wifi } from "lucide-react"
import { testConnection } from "../actions"

interface ConnectionTesterProps {
    hasConfig: boolean
}

export function ConnectionTester({ hasConfig }: ConnectionTesterProps) {
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle")

    const handleTest = async () => {
        setLoading(true)
        setStatus("idle")

        try {
            const result = await testConnection()

            if (result.success) {
                if (result.data?.success) {
                    setStatus("success")
                    toast.success("Conexión exitosa", {
                        description: result.data.message,
                    })
                } else {
                    setStatus("error")
                    toast.error("Error de conexión", {
                        description: result.data?.message || "No se pudo conectar",
                    })
                }
            } else {
                setStatus("error")
                toast.error("Error de conexión", {
                    description: result.error || "Error desconocido",
                })
            }
        } catch {
            setStatus("error")
            toast.error("Error", { description: "No se pudo probar la conexión" })
        } finally {
            setLoading(false)
        }
    }

    if (!hasConfig) {
        return (
            <div className="rounded-lg border border-dashed p-6 text-center">
                <Wifi className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-2 text-sm text-slate-500">
                    Configura tu pasarela de pago para probar la conexión
                </p>
            </div>
        )
    }

    return (
        <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {status === "idle" && <Wifi className="h-5 w-5 text-slate-400" />}
                    {status === "success" && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    {status === "error" && <XCircle className="h-5 w-5 text-red-500" />}
                    <div>
                        <p className="font-medium">Probar Conexión</p>
                        <p className="text-sm text-slate-500">
                            {status === "idle" && "Verifica que las credenciales sean correctas"}
                            {status === "success" && "La conexión funciona correctamente"}
                            {status === "error" && "No se pudo conectar. Revisa las credenciales"}
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={loading}
                >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Probar
                </Button>
            </div>
        </div>
    )
}
