import { ProgressBar } from "@/components/onboarding/progress-bar"

export default function OnboardingLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark">
            <div className="layout-container flex h-full grow flex-col">
                {/* Minimal Header */}
                <header className="flex items-center justify-center border-b border-slate-200 dark:border-slate-800 px-4 sm:px-10 py-3">
                    <div className="flex items-center gap-4 text-slate-900 dark:text-white">
                        <div className="size-6 text-primary">
                            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fill="currentColor" fillRule="evenodd"></path>
                            </svg>
                        </div>
                        <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">LandingChat</h2>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex flex-1 justify-center py-10 px-4 sm:px-6 lg:px-8">
                    <div className="w-full max-w-4xl mx-auto flex flex-col gap-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
