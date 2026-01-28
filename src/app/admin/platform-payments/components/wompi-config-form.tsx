"use client"

import { useState, useTransition } from "react"
import { savePlatformWompiConfig, testWompiConnection } from "../actions"

interface WompiConfigFormProps {
    initialConfig: {
        provider: "wompi"
        is_active: boolean
        is_test_mode: boolean
        public_key: string
        webhook_url: string
        has_private_key: boolean
        has_integrity_secret: boolean
    }
}

export function WompiConfigForm({ initialConfig }: WompiConfigFormProps) {
    const [isPending, startTransition] = useTransition()
    const [isTesting, setIsTesting] = useState(false)

    const [isActive, setIsActive] = useState(initialConfig.is_active)
    const [isTestMode, setIsTestMode] = useState(initialConfig.is_test_mode)
    const [publicKey, setPublicKey] = useState(initialConfig.public_key)
    const [privateKey, setPrivateKey] = useState("")
    const [integritySecret, setIntegritySecret] = useState("")

    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
    const [testResult, setTestResult] = useState<{
        success: boolean
        message: string
        details?: {
            merchant_name?: string
            merchant_legal_name?: string
            accepted_currencies?: string[]
        }
    } | null>(null)

    const webhookUrl = typeof window !== "undefined"
        ? `${window.location.origin}/api/webhooks/subscriptions/wompi`
        : initialConfig.webhook_url || "https://landingchat.co/api/webhooks/subscriptions/wompi"

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setMessage(null)
        setTestResult(null)

        startTransition(async () => {
            const result = await savePlatformWompiConfig({
                is_active: isActive,
                is_test_mode: isTestMode,
                public_key: publicKey,
                private_key: privateKey || undefined,
                integrity_secret: integritySecret || undefined,
            })

            if (result.success) {
                setMessage({ type: "success", text: "Configuración guardada correctamente" })
                setPrivateKey("")
                setIntegritySecret("")
            } else {
                setMessage({ type: "error", text: result.error || "Error al guardar" })
            }
        })
    }

    const handleTest = async () => {
        setIsTesting(true)
        setTestResult(null)
        setMessage(null)

        try {
            const result = await testWompiConnection()
            setTestResult(result)
        } catch {
            setTestResult({ success: false, message: "Error al probar conexión" })
        } finally {
            setIsTesting(false)
        }
    }

    const copyWebhookUrl = () => {
        navigator.clipboard.writeText(webhookUrl)
        setMessage({ type: "success", text: "URL copiada al portapapeles" })
        setTimeout(() => setMessage(null), 2000)
    }

    return (
        <div className="space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`rounded-lg border p-4 ${isActive ? "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/20" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"}`}>
                    <div className="flex items-center gap-2">
                        <div className={`size-3 rounded-full ${isActive ? "bg-green-500" : "bg-slate-400"}`} />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {isActive ? "Activo" : "Inactivo"}
                        </span>
                    </div>
                </div>

                <div className={`rounded-lg border p-4 ${isTestMode ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20" : "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/20"}`}>
                    <div className="flex items-center gap-2">
                        <div className={`size-3 rounded-full ${isTestMode ? "bg-amber-500" : "bg-green-500"}`} />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {isTestMode ? "Modo Sandbox" : "Modo Producción"}
                        </span>
                    </div>
                </div>

                <div className={`rounded-lg border p-4 ${initialConfig.has_private_key ? "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/20" : "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20"}`}>
                    <div className="flex items-center gap-2">
                        <div className={`size-3 rounded-full ${initialConfig.has_private_key ? "bg-green-500" : "bg-red-500"}`} />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {initialConfig.has_private_key ? "Credenciales configuradas" : "Credenciales pendientes"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Configuración de Wompi
                    </h2>
                </div>

                <div className="p-6 space-y-6">
                    {/* Toggles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <label className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div>
                                <span className="font-medium text-slate-900 dark:text-white">Activar Wompi</span>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Habilitar cobros con Wompi</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="h-5 w-10 appearance-none rounded-full bg-slate-300 transition-colors checked:bg-indigo-600 relative before:absolute before:content-[''] before:h-4 before:w-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform checked:before:translate-x-5"
                            />
                        </label>

                        <label className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div>
                                <span className="font-medium text-slate-900 dark:text-white">Modo de Pruebas</span>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Usar sandbox de Wompi</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={isTestMode}
                                onChange={(e) => setIsTestMode(e.target.checked)}
                                className="h-5 w-10 appearance-none rounded-full bg-slate-300 transition-colors checked:bg-amber-500 relative before:absolute before:content-[''] before:h-4 before:w-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform checked:before:translate-x-5"
                            />
                        </label>
                    </div>

                    {/* Public Key */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Public Key
                        </label>
                        <input
                            type="text"
                            value={publicKey}
                            onChange={(e) => setPublicKey(e.target.value)}
                            placeholder={isTestMode ? "pub_test_xxxxx" : "pub_prod_xxxxx"}
                            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white font-mono"
                        />
                    </div>

                    {/* Private Key */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Private Key
                            {initialConfig.has_private_key && (
                                <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                                    (ya configurada - dejar vacío para mantener)
                                </span>
                            )}
                        </label>
                        <input
                            type="password"
                            value={privateKey}
                            onChange={(e) => setPrivateKey(e.target.value)}
                            placeholder={initialConfig.has_private_key ? "••••••••••••••••" : (isTestMode ? "prv_test_xxxxx" : "prv_prod_xxxxx")}
                            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white font-mono"
                        />
                    </div>

                    {/* Integrity Secret */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Integrity Secret (Events)
                            {initialConfig.has_integrity_secret && (
                                <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                                    (ya configurado - dejar vacío para mantener)
                                </span>
                            )}
                        </label>
                        <input
                            type="password"
                            value={integritySecret}
                            onChange={(e) => setIntegritySecret(e.target.value)}
                            placeholder={initialConfig.has_integrity_secret ? "••••••••••••••••" : "test_integrity_xxxxx"}
                            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white font-mono"
                        />
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Para validar webhooks. Encuéntralo en Wompi → Configuración → Events
                        </p>
                    </div>

                    {/* Webhook URL */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Webhook URL
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={webhookUrl}
                                readOnly
                                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 font-mono"
                            />
                            <button
                                type="button"
                                onClick={copyWebhookUrl}
                                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                            >
                                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </button>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Configura esta URL en Wompi → Configuración → Events
                        </p>
                    </div>

                    {/* Messages */}
                    {message && (
                        <div className={`p-4 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"}`}>
                            {message.text}
                        </div>
                    )}

                    {testResult && (
                        <div className={`p-4 rounded-lg ${testResult.success ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
                            <div className="flex items-center gap-2 mb-2">
                                {testResult.success ? (
                                    <svg className="size-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                ) : (
                                    <svg className="size-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                )}
                                <span className={`font-medium ${testResult.success ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
                                    {testResult.message}
                                </span>
                            </div>
                            {testResult.details && (
                                <div className="mt-2 pl-7 text-sm text-green-600 dark:text-green-400">
                                    <p><strong>Comercio:</strong> {testResult.details.merchant_name}</p>
                                    <p><strong>Razón Social:</strong> {testResult.details.merchant_legal_name}</p>
                                    <p><strong>Monedas:</strong> {testResult.details.accepted_currencies?.join(", ")}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between">
                    <button
                        type="button"
                        onClick={handleTest}
                        disabled={isTesting || !publicKey}
                        className="px-4 py-2 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20 transition-colors flex items-center gap-2"
                    >
                        {isTesting ? (
                            <>
                                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Probando...
                            </>
                        ) : (
                            <>
                                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Probar Conexión
                            </>
                        )}
                    </button>

                    <button
                        type="submit"
                        disabled={isPending}
                        className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {isPending ? (
                            <>
                                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Guardando...
                            </>
                        ) : (
                            <>
                                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Guardar Configuración
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}
