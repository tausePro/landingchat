import { getPlatformWompiConfig } from "./actions"
import { WompiConfigForm } from "./components/wompi-config-form"

export default async function PlatformPaymentsPage() {
    const result = await getPlatformWompiConfig()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Pasarela de Pagos - Plataforma
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Configura Wompi para cobrar suscripciones a las organizaciones
                </p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
                <div className="flex items-start gap-3">
                    <svg className="size-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <h3 className="font-medium text-amber-800 dark:text-amber-200">
                            Importante
                        </h3>
                        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                            Estas credenciales son para cobrar a los clientes de LandingChat (suscripciones de planes).
                            NO confundir con la configuración de Wompi que cada organización configura para su tienda.
                        </p>
                    </div>
                </div>
            </div>

            {result.success && result.data ? (
                <WompiConfigForm initialConfig={result.data} />
            ) : (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
                    <p className="text-sm text-red-700 dark:text-red-300">
                        Error al cargar configuración: {result.error}
                    </p>
                </div>
            )}

            <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Instrucciones de Configuración
                </h2>
                <ol className="list-decimal list-inside space-y-3 text-sm text-slate-600 dark:text-slate-400">
                    <li>
                        <strong>Crear cuenta en Wompi:</strong>{" "}
                        <a href="https://comercios.wompi.co/register" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                            comercios.wompi.co/register
                        </a>
                    </li>
                    <li>
                        <strong>Obtener credenciales:</strong> En el panel de Wompi, ve a Configuración → Llaves de API
                    </li>
                    <li>
                        <strong>Modo de pruebas:</strong> Usa las llaves de Sandbox para probar antes de activar producción
                    </li>
                    <li>
                        <strong>Configurar Webhook:</strong> En Wompi, agrega la URL del webhook que se muestra abajo
                    </li>
                    <li>
                        <strong>Probar conexión:</strong> Usa el botón de test para verificar que todo esté correcto
                    </li>
                </ol>
            </div>
        </div>
    )
}
