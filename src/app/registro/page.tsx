"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Zap, Check, Clock, Loader2 } from "lucide-react"
import { setupNewUser, setupFoundingUser, getFoundingTierInfo } from "./actions"
import { formatFoundingPrice, calculateAnnualPrice } from "@/types"

export const dynamic = 'force-dynamic'

interface FoundingTierInfo {
    id: string
    name: string
    current_price: number
    regular_price: number
    slots_remaining: number
    free_months: number
    currency: string
}

function RegistroForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [fullName, setFullName] = useState("")
    const [error, setError] = useState<string | null>(null)

    // Founding member params
    const planSlug = searchParams.get("plan")
    const isFounding = searchParams.get("founding") === "true"
    const [foundingTier, setFoundingTier] = useState<FoundingTierInfo | null>(null)
    const [loadingTier, setLoadingTier] = useState(isFounding)

    const supabase = createClient()

    // Cargar info del tier founding si aplica
    useEffect(() => {
        if (isFounding && planSlug) {
            setLoadingTier(true)
            getFoundingTierInfo(planSlug).then((result) => {
                if (result.success && result.data) {
                    setFoundingTier(result.data)
                }
                setLoadingTier(false)
            })
        }
    }, [isFounding, planSlug])

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

            if (!data.user) {
                throw new Error("Error al crear usuario")
            }

            // 2. Configurar usuario según tipo
            if (isFounding && foundingTier) {
                // FOUNDING MEMBER: Reservar slot y redirigir a checkout
                const result = await setupFoundingUser(
                    data.user.id,
                    fullName,
                    email,
                    foundingTier.id
                )

                if (!result.success) {
                    throw new Error(result.error || "Error al reservar cupo")
                }

                // Redirigir a checkout founding con el slot reservado
                router.push(`/founding/checkout?slot=${result.slotId}`)
            } else {
                // REGISTRO NORMAL: Trial gratuito
                const result = await setupNewUser(data.user.id, fullName, email)

                if (!result.success) {
                    throw new Error(result.error || "Error al configurar usuario")
                }

                // Redirigir al onboarding
                router.push("/onboarding/welcome")
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Error al crear la cuenta"
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }

    // Calcular precios para founding
    const annualInfo = foundingTier
        ? calculateAnnualPrice(foundingTier.current_price, foundingTier.free_months)
        : null

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
                    {isFounding ? (
                        <div className="flex flex-col items-center gap-1">
                            <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                                <Zap className="size-3 mr-1" />
                                FOUNDING MEMBER
                            </Badge>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Asegura tu cupo exclusivo
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Crea tu cuenta gratis
                        </p>
                    )}
                </div>

                {/* Founding Member Info Card */}
                {isFounding && foundingTier && !loadingTier && (
                    <div className="mb-6 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                                Plan {foundingTier.name}
                            </span>
                            <Badge className="bg-emerald-500 text-white">
                                {foundingTier.slots_remaining} cupos
                            </Badge>
                        </div>
                        <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                                <Check className="size-4 text-emerald-600" />
                                <span>
                                    <strong>{formatFoundingPrice(foundingTier.current_price)}/mes</strong>
                                    <span className="text-slate-500 line-through ml-2">
                                        {formatFoundingPrice(foundingTier.regular_price)}
                                    </span>
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="size-4 text-emerald-600" />
                                <span>Precio congelado de por vida</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="size-4 text-emerald-600" />
                                <span>Paga {annualInfo?.monthsPaid} meses, obtén 12</span>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-700">
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                <Clock className="size-3" />
                                Pago anual único: <strong>{formatFoundingPrice(annualInfo?.totalPrice || 0)}</strong>
                            </p>
                        </div>
                    </div>
                )}

                {loadingTier && isFounding && (
                    <div className="mb-6 flex items-center justify-center py-4">
                        <Loader2 className="size-6 animate-spin text-primary" />
                    </div>
                )}

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

                        <Button
                            type="submit"
                            disabled={loading || (isFounding && !foundingTier)}
                            className={`w-full h-12 mt-2 ${isFounding
                                ? "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600"
                                : ""
                                }`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                    {isFounding ? "Reservando cupo..." : "Creando cuenta..."}
                                </>
                            ) : isFounding ? (
                                <>
                                    <Zap className="mr-2 size-4" />
                                    Asegurar Mi Cupo
                                </>
                            ) : (
                                "Crear Cuenta"
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link href="/login" className="text-sm text-primary hover:underline">
                            ¿Ya tienes cuenta? Inicia sesión
                        </Link>
                    </div>

                    <div className="mt-4 text-center">
                        <Link
                            href={isFounding ? "/founding" : "/"}
                            className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary"
                        >
                            ← {isFounding ? "Volver a planes founding" : "Volver al inicio"}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function RegistroPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="size-8 animate-spin text-primary" />
            </div>
        }>
            <RegistroForm />
        </Suspense>
    )
}
