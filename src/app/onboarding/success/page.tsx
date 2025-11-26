import Link from "next/link"
import { Button } from "@/components/ui/button"
import { completeOnboarding } from "../actions"

export default function SuccessPage() {
    return (
        <>
            {/* Success Icon */}
            <div className="flex justify-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <span className="material-symbols-outlined !text-6xl">check_circle</span>
                </div>
            </div>

            {/* Page Heading */}
            <div className="flex flex-wrap justify-center gap-3 text-center">
                <div className="flex w-full flex-col items-center gap-3">
                    <h1 className="text-slate-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em] sm:text-5xl">
                        ¡Felicidades! Tu espacio de trabajo está listo.
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal max-w-2xl">
                        Has configurado con éxito tu tienda y tu primer agente. Ahora estás listo para empezar a vender y conversar con tus clientes.
                    </p>
                </div>
            </div>

            {/* Next Steps Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-1 flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center items-center">
                    <div className="text-primary">
                        <span className="material-symbols-outlined !text-3xl">dashboard</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">
                            Explora tu Dashboard
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">
                            Visualiza tus métricas y gestiona tu operación.
                        </p>
                    </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center items-center">
                    <div className="text-primary">
                        <span className="material-symbols-outlined !text-3xl">smart_toy</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">
                            Conoce a tu Agente
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">
                            Prueba las conversaciones y personaliza sus respuestas.
                        </p>
                    </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center items-center">
                    <div className="text-primary">
                        <span className="material-symbols-outlined !text-3xl">add_shopping_cart</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">
                            Añade más productos
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">
                            Amplía tu catálogo para ofrecer más a tus clientes.
                        </p>
                    </div>
                </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex justify-center pt-4">
                <div className="flex w-full flex-col sm:flex-row flex-wrap gap-3 max-w-lg justify-center">
                    <form action={completeOnboarding}>
                        <Button type="submit" className="h-12 px-5">
                            <span className="truncate">Ir al Dashboard</span>
                        </Button>
                    </form>
                    <Link href="/dashboard/agents">
                        <Button variant="secondary" className="h-12 px-5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700">
                            <span className="truncate">Gestionar Agentes</span>
                        </Button>
                    </Link>
                    <Link href="/dashboard/products">
                        <Button variant="secondary" className="h-12 px-5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700">
                            <span className="truncate">Añadir Productos</span>
                        </Button>
                    </Link>
                </div>
            </div>
        </>
    )
}
