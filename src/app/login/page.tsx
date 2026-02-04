"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Layers, Eye, EyeOff, ArrowRight, Loader2, Mail, Lock } from "lucide-react"

export const dynamic = "force-dynamic"

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [oauthLoading, setOauthLoading] = useState<string | null>(null)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if (error) throw error
            router.push("/dashboard")
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error al iniciar sesión"
            setError(message)
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
            <div className="relative z-10 w-full max-w-md px-4">
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
                    <p className="text-sm text-gray-500">Ingresa a tu cuenta para continuar</p>
                </div>

                {/* Glass card */}
                <div className="rounded-2xl border border-white/60 bg-white/80 p-8 shadow-xl shadow-black/[0.03] backdrop-blur-xl">
                    {/* OAuth buttons */}
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

                    {/* Email form */}
                    <form onSubmit={handleLogin} className="space-y-4">
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
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700">Contrase&ntilde;a</label>
                                <Link
                                    href="/recuperar"
                                    className="text-xs font-medium text-landing-violet hover:text-landing-violet-light transition-colors"
                                >
                                    &iquest;Olvidaste tu contrase&ntilde;a?
                                </Link>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
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
                            disabled={loading || !!oauthLoading}
                            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-landing-deep px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-landing-deep/20 transition-all hover:shadow-2xl hover:shadow-landing-violet/25 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-xl"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Ingresando...
                                </>
                            ) : (
                                <>
                                    Iniciar Sesi&oacute;n
                                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Register link */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-500">
                            &iquest;No tienes cuenta?{" "}
                            <Link
                                href="/registro"
                                className="font-semibold text-landing-violet hover:text-landing-violet-light transition-colors"
                            >
                                Reg&iacute;strate gratis
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Back to home */}
                <div className="mt-6 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-landing-violet"
                    >
                        <ArrowRight className="size-3.5 rotate-180" />
                        Volver al inicio
                    </Link>
                </div>
            </div>
        </div>
    )
}
