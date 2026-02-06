import Link from "next/link"
import { Layers } from "lucide-react"

export default function OnboardingLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-landing-surface font-landing">
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

            {/* Content */}
            <div className="relative z-10 flex h-full grow flex-col">
                {/* Header */}
                <header className="flex items-center justify-center border-b border-white/20 bg-white/40 backdrop-blur-sm px-4 sm:px-10 py-4">
                    <Link href="/" className="group flex items-center gap-3 transition-transform hover:scale-105">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-landing-deep text-white shadow-lg shadow-landing-violet/20">
                            <Layers className="size-5" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight text-landing-deep">
                            LandingChat{" "}
                            <span className="ml-1 rounded-full border border-landing-violet/20 bg-landing-violet/10 px-2 py-0.5 text-xs font-normal text-landing-violet">
                                OS
                            </span>
                        </h2>
                    </Link>
                </header>

                {/* Main Content */}
                <main className="flex flex-1 justify-center py-10 px-4 sm:px-6 lg:px-8">
                    <div className="w-full max-w-3xl mx-auto flex flex-col gap-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
