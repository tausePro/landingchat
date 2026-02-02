"use client"

import { useEffect, useState } from "react"
import { MessageSquare, ExternalLink, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
    getMetaWhatsAppConfig,
    saveMetaWhatsAppConfig,
} from "./actions"

export default function MetaWhatsAppSettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [copied, setCopied] = useState(false)

    const [appId, setAppId] = useState("")
    const [appSecret, setAppSecret] = useState("")
    const [verifyToken, setVerifyToken] = useState("")
    const [configId, setConfigId] = useState("")
    const [solutionId, setSolutionId] = useState("")
    const [webhookUrl, setWebhookUrl] = useState("")

    useEffect(() => {
        fetchConfig()
    }, [])

    const fetchConfig = async () => {
        const result = await getMetaWhatsAppConfig()
        if (result.success && result.data) {
            setAppId(result.data.app_id)
            setAppSecret(result.data.app_secret)
            setVerifyToken(result.data.verify_token)
            setConfigId(result.data.config_id || "")
            setSolutionId(result.data.solution_id || "")
            setWebhookUrl(result.data.webhook_url)
        } else {
            // Generar verify_token por defecto
            setVerifyToken(`lc_verify_${Math.random().toString(36).substring(2, 15)}`)
            setWebhookUrl(`${window.location.origin}/api/webhooks/whatsapp-meta`)
        }
        setLoading(false)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        try {
            const result = await saveMetaWhatsAppConfig({
                app_id: appId,
                app_secret: appSecret,
                verify_token: verifyToken,
                config_id: configId || undefined,
                solution_id: solutionId || undefined,
            })

            if (result.success) {
                toast.success("Configuraci\u00f3n guardada", {
                    description: "Meta WhatsApp Cloud API ha sido configurado correctamente.",
                })
                fetchConfig()
            } else {
                toast.error("Error", { description: result.error })
            }
        } catch {
            toast.error("Error", { description: "No se pudo guardar la configuraci\u00f3n" })
        } finally {
            setSaving(false)
        }
    }

    const copyWebhookUrl = () => {
        navigator.clipboard.writeText(webhookUrl)
        setCopied(true)
        toast.success("URL copiada")
        setTimeout(() => setCopied(false), 2000)
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
                <div className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5">
                    <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Meta WhatsApp Cloud API</h1>
                    <p className="text-slate-500">
                        Configuraci\u00f3n oficial de WhatsApp Business Platform
                    </p>
                </div>
                <Badge className="ml-auto bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    Oficial
                </Badge>
            </div>

            {/* Webhook URL para copiar */}
            <div className="rounded-xl border bg-blue-50 p-4 dark:bg-blue-900/20">
                <h3 className="mb-2 text-sm font-semibold text-blue-900 dark:text-blue-300">
                    Webhook URL para Meta
                </h3>
                <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-white px-3 py-2 text-sm dark:bg-slate-800">
                        {webhookUrl}
                    </code>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={copyWebhookUrl}
                    >
                        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
                <p className="mt-2 text-xs text-blue-700 dark:text-blue-400">
                    Usa esta URL en developers.facebook.com → WhatsApp → Configuration → Webhook
                </p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900">
                    <h2 className="mb-4 text-lg font-semibold">Credenciales de la App</h2>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="appId">App ID</Label>
                            <Input
                                id="appId"
                                value={appId}
                                onChange={(e) => setAppId(e.target.value)}
                                placeholder="123456789012345"
                                required
                            />
                            <p className="text-xs text-slate-500">
                                ID de tu app en developers.facebook.com
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="appSecret">App Secret</Label>
                            <Input
                                id="appSecret"
                                type="password"
                                value={appSecret}
                                onChange={(e) => setAppSecret(e.target.value)}
                                placeholder="Tu App Secret"
                                required
                            />
                            <p className="text-xs text-slate-500">
                                Configuraci\u00f3n → B\u00e1sica → Clave secreta de la aplicaci\u00f3n
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="verifyToken">Verify Token</Label>
                            <Input
                                id="verifyToken"
                                value={verifyToken}
                                onChange={(e) => setVerifyToken(e.target.value)}
                                placeholder="lc_verify_abc123"
                                required
                            />
                            <p className="text-xs text-slate-500">
                                Token que Meta env\u00eda para verificar el webhook. Usa este mismo valor en la configuraci\u00f3n del webhook en Meta.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900">
                    <h2 className="mb-4 text-lg font-semibold">Embedded Signup (Opcional)</h2>
                    <p className="mb-4 text-sm text-slate-500">
                        Permite a los comerciantes conectar su WhatsApp Business directamente desde el dashboard.
                    </p>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="configId">Configuration ID</Label>
                            <Input
                                id="configId"
                                value={configId}
                                onChange={(e) => setConfigId(e.target.value)}
                                placeholder="ID de configuraci\u00f3n de Embedded Signup"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="solutionId">Solution ID</Label>
                            <Input
                                id="solutionId"
                                value={solutionId}
                                onChange={(e) => setSolutionId(e.target.value)}
                                placeholder="ID de soluci\u00f3n de Embedded Signup"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button type="submit" disabled={saving} className="flex-1">
                        {saving ? "Guardando..." : "Guardar Configuraci\u00f3n"}
                    </Button>
                </div>
            </form>

            {/* Pasos de configuración */}
            <div className="rounded-xl border bg-slate-50 p-6 dark:bg-slate-800/50">
                <h2 className="mb-3 text-lg font-semibold">Pasos de configuraci\u00f3n</h2>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-400">
                    <li>Crear app en <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">developers.facebook.com</a> tipo Business</li>
                    <li>Agregar el producto WhatsApp a la app</li>
                    <li>Copiar App ID y App Secret de Configuraci\u00f3n → B\u00e1sica</li>
                    <li>Ir a WhatsApp → Configuraci\u00f3n → Webhook</li>
                    <li>Pegar la Webhook URL y Verify Token de arriba</li>
                    <li>Suscribirse al campo <strong>messages</strong></li>
                    <li>Verificar el dominio de negocio en Business Manager</li>
                </ol>

                <div className="mt-4 flex gap-3">
                    <a
                        href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Documentaci\u00f3n Cloud API
                    </a>
                    <a
                        href="https://developers.facebook.com/docs/whatsapp/embedded-signup"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Documentaci\u00f3n Embedded Signup
                    </a>
                </div>
            </div>
        </div>
    )
}
