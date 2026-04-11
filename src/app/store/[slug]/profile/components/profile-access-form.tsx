"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface ProfileAccessFormProps {
    slug: string
    organizationName: string
}

export function ProfileAccessForm({ slug, organizationName }: ProfileAccessFormProps) {
    const router = useRouter()
    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsSubmitting(true)
        setError(null)

        try {
            const normalizedPhone = phone.replace(/\D/g, "")

            const response = await fetch(`/api/store/${slug}/identify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    phone: normalizedPhone.length === 10 ? `+57${normalizedPhone}` : normalizedPhone,
                    mode: "profile",
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "No pudimos validar tu acceso")
            }

            router.refresh()
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "No pudimos validar tu acceso")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="text-center mb-6">
                        <div className="flex size-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/20 mx-auto mb-4">
                            <span className="material-symbols-outlined text-2xl">smartphone</span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            Mi Cuenta
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Valida tu acceso con el mismo nombre y WhatsApp que usaste en {organizationName}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Nombre completo
                            </label>
                            <input
                                id="name"
                                type="text"
                                required
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="Ej. Juan Pérez"
                            />
                        </div>

                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Número de WhatsApp
                            </label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 text-sm">
                                    +57
                                </span>
                                <input
                                    id="phone"
                                    type="tel"
                                    required
                                    pattern="[0-9]{10}"
                                    maxLength={10}
                                    value={phone}
                                    onChange={(event) => setPhone(event.target.value)}
                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-r-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                                    placeholder="300 123 4567"
                                />
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                                El mismo número que usaste para chatear o comprar
                            </p>
                        </div>

                        {error && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white py-2.5 px-4 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">login</span>
                            {isSubmitting ? "Validando acceso..." : "Ver Mi Cuenta"}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link
                            href={`/store/${slug}`}
                            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                        >
                            ← Volver a la tienda
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
