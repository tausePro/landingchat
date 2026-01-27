import { CreditCard } from "lucide-react"
import { PaymentConfigWrapper } from "./components/payment-config-wrapper"
import { ManualPaymentForm } from "./components/manual-payment-form"

export const metadata = {
    title: "Pasarela de Pago | Dashboard",
    description: "Configura tu pasarela de pago para recibir pagos de clientes",
}

export default function PaymentsSettingsPage() {
    return (
        <div className="mx-auto max-w-2xl space-y-6 p-6">
            <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 p-2.5">
                    <CreditCard className="h-5 w-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Pasarela de Pago</h1>
                    <p className="text-slate-500">
                        Configura tu pasarela para recibir pagos de clientes
                    </p>
                </div>
            </div>

            <PaymentConfigWrapper />

            <ManualPaymentForm />
        </div>
    )
}

