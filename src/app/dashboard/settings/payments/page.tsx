import { PaymentConfigWrapper } from "./components/payment-config-wrapper"
import { ManualPaymentMethods } from "./components/manual-payment-methods"

export const metadata = {
    title: "Pasarelas de Pago | Dashboard",
    description: "Configura tus pasarelas para recibir pagos de clientes",
}

export default function PaymentsSettingsPage() {
    return (
        <div className="mx-auto max-w-3xl p-8">
            {/* Header */}
            <div className="flex flex-col gap-2 mb-8">
                <h1 className="text-slate-900 dark:text-white text-3xl font-bold leading-tight tracking-tight">
                    Pasarelas de Pago
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal">
                    Configura tus pasarelas para recibir pagos de clientes.
                </p>
            </div>

            <div className="flex flex-col gap-6">
                {/* Pasarelas Online */}
                <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
                        Pasarelas de Pago Online
                    </h2>
                    <PaymentConfigWrapper />
                </div>

                {/* Métodos Manuales */}
                <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
                        Otros Métodos de Pago Directos
                    </h2>
                    <ManualPaymentMethods />
                </div>

                {/* Documentación */}
                <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                        Documentación
                    </h2>
                    <div className="space-y-3">
                        <a 
                            href="https://docs.wompi.co/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between text-sm text-primary hover:underline"
                        >
                            <span>Guía de configuración de pasarelas</span>
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </a>
                        <a 
                            href="https://docs.epayco.co/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between text-sm text-primary hover:underline"
                        >
                            <span>Preguntas frecuentes sobre pagos</span>
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}
