"use client"

import { useEffect, useState } from "react"
import { MessageSquare, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
    getEvolutionConfig,
    saveEvolutionConfig,
    testEvolutionConnection,
} from "./actions"

export default function EvolutionSettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)

    const [url, setUrl] = useState("")
    const [apiKey, setApiKey] = useState("")
    const [webhookSecret, setWebhookSecret] = useState("")

    useEffect(() => {
        fetchConfig()
    }, [])

    const fetchConfig = async () => {
        const result = await getEvolutionConfig()
        if (result.success && result.data) {
            setUrl(result.data.url)
            setApiKey(result.data.apiKey)
        }
        setLoading(false)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        try {
            const result = await saveEvolutionConfig({
                url,
                apiKey,
                webhookSecret: webhookSecret || undefined,
            })

            if (result.success) {
                toast.success("Configuración guardada", {
                    description: "Evolution API ha sido configurado correctamente.",
                })
                fetchConfig()
            } else {
                toast.error("Error", { description: result.error })
            }
        } catch {
            toast.error("Error", { description: "No se pudo guardar la configuración" })
        } finally {
            setSaving(false)
        }
    }

    const handleTest = async () => {
        setTesting(true)

        try {
            const result = await testEvolutionConnection()

            if (result.success) {
                if (result.data?.success) {
                    toast.success("Conexión exitosa", {
                        description: result.data.message,
                    })
                } else {
                    toast.error("Error de conexión", {
                        description: result.data?.message || "No se pudo conectar",
                    })
                }
            } else {
                toast.error("Error", { description: result.error })
            }
        } catch {
            toast.error("Error", { description: "No se pudo probar la conexión" })
        } finally {
            setTesting(false)
        }
    }

    if (loading) {
        return (
            <div className="mx-auto max-w-2xl space-y-6 p-6">
                <div className="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6 p-6">
            <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 p-2.5">
                    <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Evolution API</h1>
                    <p className="text-slate-500">
                        Configuración de WhatsApp para la plataforma
                    </p>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900">
                    <h2 className="mb-4 text-lg font-semibold">Configuración</h2>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="url">URL de Evolution API</Label>
                            <Input
                                id="url"
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://wa.tause.pro"
                                required
                            />
                            <p className="text-xs text-slate-500">
                                URL base de tu instancia de Evolution API
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="apiKey">API Key</Label>
                            <Input
                                id="apiKey"
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Tu API Key de Evolution"
                                required
                            />
                            <p className="text-xs text-slate-500">
                                API Key global de Evolution API
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="webhookSecret">
                                Webhook Secret (Opcional)
                            </Label>
                            <Input
                                id="webhookSecret"
                                type="password"
                                value={webhookSecret}
                                onChange={(e) => setWebhookSecret(e.target.value)}
                                placeholder="Secreto para validar webhooks"
                            />
                            <p className="text-xs text-slate-500">
                                Secreto para validar la autenticidad de los webhooks
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 flex gap-3">
                        <Button type="submit" disabled={saving} className="flex-1">
                            {saving ? "Guardando..." : "Guardar Configuración"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleTest}
                            disabled={testing || !url || !apiKey}
                        >
                            {testing ? "Probando..." : "Probar Conexión"}
                        </Button>
                    </div>
                </div>
            </form>

            <div className="rounded-xl border bg-slate-50 p-6 dark:bg-slate-800/50">
                <h2 className="mb-3 text-lg font-semibold">Documentación</h2>
                <a
                    href="https://doc.evolution-api.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                    <ExternalLink className="h-4 w-4" />
                    Documentación de Evolution API
                </a>
            </div>
        </div>
    )
}
