import { CreditCard } from "lucide-react"
import { PaymentSettingsPanel } from "./components/payment-settings-panel"

export const metadata = {
    title: "Medios de Pago | Dashboard",
    description: "Configura tus medios de pago para recibir pagos de clientes",
}

export default function PaymentsSettingsPage() {
    return (
        <div className="mx-auto max-w-3xl space-y-6 p-6">
            <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 p-2.5">
                    <CreditCard className="h-5 w-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Medios de Pago</h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Activa y configura los medios de pago de tu tienda
                    </p>
                </div>
            </div>

            <PaymentSettingsPanel />
        </div>
    )
}

