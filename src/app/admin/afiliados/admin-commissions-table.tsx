"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { approveCommission, markCommissionPaid, type AdminCommission } from "./actions"
import { toast } from "sonner"

const formatCOP = (amount: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount)

const STATUS_LABEL: Record<string, string> = { pending: "Pendiente", approved: "Aprobada", paid: "Pagada" }

export function AdminCommissionsTable({ initial }: { initial: AdminCommission[] }) {
    const [rows, setRows] = useState<AdminCommission[]>(initial)
    const [busy, setBusy] = useState<string | null>(null)

    const act = async (
        id: string,
        fn: (id: string) => Promise<{ success: boolean; error?: string }>,
        newStatus: string,
    ) => {
        setBusy(id)
        const res = await fn(id)
        if (res.success) {
            setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)))
            toast.success("Comisión actualizada")
        } else {
            toast.error(res.error ?? "Error")
        }
        setBusy(null)
    }

    if (rows.length === 0) {
        return <p className="text-sm text-slate-500 dark:text-slate-400">Aún no hay comisiones generadas.</p>
    }

    return (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900/50">
            <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <tr>
                        <th className="px-4 py-3">Afiliado</th>
                        <th className="px-4 py-3">Base</th>
                        <th className="px-4 py-3">%</th>
                        <th className="px-4 py-3">Comisión</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Acción</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200">{r.affiliateCode}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatCOP(r.baseAmount)}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.rate}%</td>
                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{formatCOP(r.amount)}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{STATUS_LABEL[r.status] ?? r.status}</td>
                            <td className="px-4 py-3 text-right">
                                {r.status === "pending" && (
                                    <Button size="sm" disabled={busy === r.id} onClick={() => act(r.id, approveCommission, "approved")}>
                                        Aprobar
                                    </Button>
                                )}
                                {r.status === "approved" && (
                                    <Button size="sm" disabled={busy === r.id} onClick={() => act(r.id, markCommissionPaid, "paid")}>
                                        Marcar pagada
                                    </Button>
                                )}
                                {r.status === "paid" && <span className="text-xs font-medium text-emerald-600">Pagada</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
