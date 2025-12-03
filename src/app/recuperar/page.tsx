"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"

export const dynamic = 'force-dynamic'

export default function RecuperarPage() {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const supabase = createClient()

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(false)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/login?reset=true`,
            })
            if (error) throw error
            setSuccess(true)
        } catch (err: any) {
            setError(err.message || "Error al enviar el correo de recuperación")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-background-light dark:bg-background-dark px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex flex-col items-center gap-2 mb-8">
                    <div className="size-12 text-primary">
                        <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd"></path>
                        </svg>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">LandingChat</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Recupera tu contraseña
                    </p>
                </div>

                {/* Form */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
                    {success ? (
                        <div className="text-center">
                            <div className="mb-4 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                                <p className="font-medium">¡Correo enviado!</p>
                                <p className="text-sm mt-2">
                                    Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.
                                </p>
                            </div>
                            <Link href="/login" className="text-sm text-primary hover:underline">
                                Volver al inicio de sesión
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
                            </p>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                    Email
                                </label>
                                <Input
                                    type="email"
                                    placeholder="tu@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            {error && (
                                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                                    {error}
                                </div>
                            )}

                            <Button type="submit" disabled={loading} className="w-full h-12 mt-2">
                                {loading ? "Enviando..." : "Enviar Enlace de Recuperación"}
                            </Button>

                            <div className="mt-4 text-center">
                                <Link href="/login" className="text-sm text-primary hover:underline">
                                    ← Volver al inicio de sesión
                                </Link>
                            </div>
                        </form>
                    )}

                    <div className="mt-4 text-center">
                        <Link href="/" className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary">
                            ← Volver al inicio
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
