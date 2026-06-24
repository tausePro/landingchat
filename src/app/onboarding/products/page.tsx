import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/onboarding/progress-bar"
import { StoreImportCard } from "./components/store-import-card"

export default function ProductIntegrationPage() {
    return (
        <>
            <ProgressBar currentStep={4} totalSteps={7} stepLabel="Integra tu catálogo de productos" />

            <div className="flex flex-wrap justify-between gap-4 py-4">
                <div className="flex flex-col gap-1">
                    <p className="text-slate-900 dark:text-slate-50 text-3xl font-extrabold leading-tight tracking-tight">
                        Integra tu catálogo de productos
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal">
                        Elige el método que mejor se adapte a tu negocio para empezar a vender a través del chat.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 py-8 md:grid-cols-2 lg:grid-cols-3">
                {/* Bulk Upload Card */}
                <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-shadow hover:shadow-lg">
                    <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-3xl">upload_file</span>
                    </div>
                    <div className="flex flex-grow flex-col gap-2">
                        <p className="text-slate-900 dark:text-slate-50 text-lg font-bold leading-normal">
                            Carga masiva con un archivo
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">
                            Ideal para catálogos grandes. Sube rápidamente todos tus productos usando nuestra plantilla.
                        </p>
                    </div>
                    <div className="flex flex-col items-start gap-3">
                        <Button className="w-full h-11 px-5 text-sm">
                            <span className="truncate">Seleccionar archivo</span>
                        </Button>
                        <a className="text-primary dark:text-primary/90 text-sm font-medium hover:underline" href="#">
                            Descargar plantilla (CSV/Excel)
                        </a>
                    </div>
                </div>

                {/* Onboarding mágico: importa desde la web actual del merchant */}
                <StoreImportCard />

                {/* Manual Entry Card */}
                <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-shadow hover:shadow-lg">
                    <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-3xl">add_box</span>
                    </div>
                    <div className="flex flex-grow flex-col gap-2">
                        <p className="text-slate-900 dark:text-slate-50 text-lg font-bold leading-normal">
                            Añadir productos manualmente
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">
                            Perfecto para catálogos pequeños o para añadir productos específicos de forma rápida.
                        </p>
                    </div>
                    <div className="mt-auto flex flex-col items-start">
                        <Button className="w-full h-11 px-5 text-sm">
                            <span className="truncate">Añadir un producto</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Skip Button */}
            <div className="flex justify-center py-6 mt-auto">
                <Link href="/onboarding/preview">
                    <Button variant="secondary" className="h-11 px-5 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800">
                        <span className="truncate">Omitir por ahora</span>
                    </Button>
                </Link>
            </div>
        </>
    )
}
