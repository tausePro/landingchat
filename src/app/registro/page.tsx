"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Layers, Eye, EyeOff, ArrowRight, Loader2, Mail, Lock, User, Zap, Check, Clock } from "lucide-react"
import { setupNewUser, setupFoundingUser, getFoundingTierInfo } from "./actions"
import { formatFoundingPrice, calculateAnnualPrice } from "@/types"

export const dynamic = "force-dynamic"

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
    const [oauthLoading, setOauthLoading] = useState<string | null>(null)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [fullName, setFullName] = useState("")
    const [showPassword, setShowPassword] = useState(false)
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

    const handleOAuth = async (provider: "google" | "facebook") => {
        setOauthLoading(provider)
        setError(null)

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            })
            if (error) throw error
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error con autenticación social"
            setError(message)
            setOauthLoading(null)
        }
    }

    // Calcular precios para founding
    const annualInfo = foundingTier
        ? calculateAnnualPrice(foundingTier.current_price, foundingTier.free_months)
        : null

    return (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-landing-surface font-landing">
            {/* Background gradient blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {/* Top-right mint blob */}
                <div
                    className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full opacity-30 blur-[120px]"
                    style={{ background: "radial-gradient(circle, #00E0C6 0%, transparent 70%)" }}
                />
                {/* Bottom-left violet blob */}
                <div
                    className="absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full opacity-25 blur-[140px]"
                    style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }}
                />
                {/* Center subtle blob */}
                <div
                    className="absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-[100px]"
                    style={{ background: "radial-gradient(circle, #6366f1 0%, #00E0C6 50%, transparent 70%)" }}
                />
                {/* Grain overlay */}
                <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E\")" }} />
            </div>

            {/* Main card */}
            <div className="relative z-10 w-full max-w-md px-4 py-8">
                {/* Logo */}
                <div className="mb-8 flex flex-col items-center gap-3">
                    <Link href="/" className="group flex items-center gap-3 transition-transform hover:scale-105">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-landing-deep text-white shadow-lg shadow-landing-violet/20">
                            <Layers className="size-6" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-landing-deep">
                            LandingChat{" "}
                            <span className="ml-1 rounded-full border border-landing-violet/20 bg-landing-violet/10 px-2 py-0.5 text-xs font-normal text-landing-violet">
                                OS
                            </span>
                        </h1>
                    </Link>
                    {isFounding ? (
                        <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-600">
                                <Zap className="size-3" />
                                FOUNDING MEMBER
                            </span>
                            <p className="text-sm text-gray-500">Asegura tu cupo exclusivo</p>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">Crea tu cuenta gratis y empieza a vender</p>
                    )}
                </div>

                {/* Founding Member Info Card */}
                {isFounding && foundingTier && !loadingTier && (
                    <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-4">
                            <span className="font-semibold text-emerald-800">
                                Plan {foundingTier.name}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-medium text-white">
                                {foundingTier.slots_remaining} cupos
                            </span>
                        </div>
                        <div className="space-y-2 text-sm">
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
                        <div className="mt-4 pt-4 border-t border-emerald-200">
                            <p className="text-xs text-emerald-700 flex items-center gap-1">
                                <Clock className="size-3" />
                                Pago anual único: <strong>{formatFoundingPrice(annualInfo?.totalPrice || 0)}</strong>
                            </p>
                        </div>
                    </div>
                )}

                {loadingTier && isFounding && (
                    <div className="mb-6 flex items-center justify-center py-4">
                        <Loader2 className="size-6 animate-spin text-landing-violet" />
                    </div>
                )}

                {/* Glass card */}
                <div className="rounded-2xl border border-white/60 bg-white/80 p-8 shadow-xl shadow-black/[0.03] backdrop-blur-xl">
                    {/* OAuth buttons - Only for non-founding registration */}
                    {!isFounding && (
                        <>
                            <div className="mb-6 space-y-3">
                                <button
                                    type="button"
                                    onClick={() => handleOAuth("google")}
                                    disabled={!!oauthLoading || loading}
                                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {oauthLoading === "google" ? (
                                        <Loader2 className="size-5 animate-spin" />
                                    ) : (
                                        <svg className="size-5" viewBox="0 0 24 24">
                                            <path
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                                                fill="#4285F4"
                                            />
                                            <path
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                fill="#34A853"
                                            />
                                            <path
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                                fill="#FBBC05"
                                            />
                                            <path
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                                fill="#EA4335"
                                            />
                                        </svg>
                                    )}
                                    Continuar con Google
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleOAuth("facebook")}
                                    disabled={!!oauthLoading || loading}
                                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {oauthLoading === "facebook" ? (
                                        <Loader2 className="size-5 animate-spin" />
                                    ) : (
                                        <svg className="size-5" viewBox="0 0 24 24" fill="#1877F2">
                                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                        </svg>
                                    )}
                                    Continuar con Meta
                                </button>
                            </div>

                            {/* Divider */}
                            <div className="relative mb-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center text-xs">
                                    <span className="bg-white/80 px-3 text-gray-400">o con tu email</span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Email form */}
                    <form onSubmit={handleSignup} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Nombre completo</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Juan Pérez"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    required
                                    className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-landing-violet focus:outline-none focus:ring-2 focus:ring-landing-violet/20"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="email"
                                    placeholder="tu@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-landing-violet focus:outline-none focus:ring-2 focus:ring-landing-violet/20"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-12 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-landing-violet focus:outline-none focus:ring-2 focus:ring-landing-violet/20"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500">Mínimo 6 caracteres</p>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                                <svg className="mt-0.5 size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !!oauthLoading || (isFounding && !foundingTier)}
                            className={`group flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-xl transition-all hover:shadow-2xl hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-xl ${
                                isFounding
                                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-emerald-500/20 hover:shadow-emerald-500/25"
                                    : "bg-landing-deep shadow-landing-deep/20 hover:shadow-landing-violet/25"
                            }`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    {isFounding ? "Reservando cupo..." : "Creando cuenta..."}
                                </>
                            ) : isFounding ? (
                                <>
                                    <Zap className="size-4" />
                                    Asegurar Mi Cupo
                                </>
                            ) : (
                                <>
                                    Crear Cuenta
                                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Login link */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-500">
                            ¿Ya tienes cuenta?{" "}
                            <Link
                                href="/login"
                                className="font-semibold text-landing-violet hover:text-landing-violet-light transition-colors"
                            >
                                Inicia sesión
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Back link */}
                <div className="mt-6 text-center">
                    <Link
                        href={isFounding ? "/founding" : "/"}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-landing-violet"
                    >
                        <ArrowRight className="size-3.5 rotate-180" />
                        {isFounding ? "Volver a planes founding" : "Volver al inicio"}
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default function RegistroPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-landing-surface">
                    <Loader2 className="size-8 animate-spin text-landing-violet" />
                </div>
            }
        >
            <RegistroForm />
        </Suspense>
    )
}
