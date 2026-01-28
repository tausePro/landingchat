"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { setupNewUser } from "./actions"

export const dynamic = 'force-dynamic'

export default function RegistroPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [fullName, setFullName] = useState("")
    const [error, setError] = useState<string | null>(null)

    const supabase = createClient()

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            // 1. Sign up con Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    },
                },
            })
            if (error) throw error

            // 2. Configurar usuario (org + perfil + suscripción trial)
            if (data.user) {
                const result = await setupNewUser(data.user.id, fullName, email)

                if (!result.success) {
                    throw new Error(result.error || "Error al configurar usuario")
                }
            }

            // 3. Redirigir al onboarding
            router.push("/onboarding/welcome")
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Error al crear la cuenta"
            setError(errorMessage)
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
                        Crea tu cuenta gratis
                    </p>
                </div>

                {/* Form */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
                    <form onSubmit={handleSignup} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                Nombre Completo
                            </label>
                            <Input
                                type="text"
                                placeholder="Juan Pérez"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                            />
                        </div>

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

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                Contraseña
                            </label>
                            <Input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                            <p className="text-xs text-slate-500">Mínimo 6 caracteres</p>
                        </div>

                        {error && (
                            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                                {error}
                            </div>
                        )}

                        <Button type="submit" disabled={loading} className="w-full h-12 mt-2">
                            {loading ? "Creando cuenta..." : "Crear Cuenta"}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link href="/login" className="text-sm text-primary hover:underline">
                            ¿Ya tienes cuenta? Inicia sesión
                        </Link>
                    </div>

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
