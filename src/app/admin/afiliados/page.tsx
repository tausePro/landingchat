import { getAdminCommissions } from "./actions"
import { AdminCommissionsTable } from "./admin-commissions-table"

export const dynamic = "force-dynamic"

export default async function AdminAffiliatesPage() {
    const result = await getAdminCommissions()
    const commissions = result.success ? result.data : []

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Comisiones de afiliados</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Aprueba las comisiones pendientes y márcalas como pagadas cuando hagas el pago al afiliado.
                </p>
            </div>

            {result.success ? (
                <AdminCommissionsTable initial={commissions} />
            ) : (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                    {result.error}
                </div>
            )}
        </div>
    )
}
