import { ManualPaymentForm } from "../components/manual-payment-form"

export const metadata = {
    title: "Pagos Manuales | Dashboard",
    description: "Configura transferencias bancarias y pago contra entrega",
}

export default function ManualPaymentPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Pagos Manuales</h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Configura transferencias bancarias y pago contra entrega para tu tienda.
                </p>
            </div>

            <ManualPaymentForm />
        </div>
    )
}
