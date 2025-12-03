"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getCoupons, deleteCoupon, toggleCouponStatus, Coupon } from "./actions"

export default function CouponsPage() {
    const router = useRouter()
    const [coupons, setCoupons] = useState<Coupon[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadCoupons()
    }, [])

    async function loadCoupons() {
        try {
            const data = await getCoupons()
            setCoupons(data)
        } catch (error) {
            console.error("Error loading coupons:", error)
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("¿Estás seguro de eliminar este cupón?")) return

        try {
            await deleteCoupon(id)
            loadCoupons()
        } catch (error) {
            console.error("Error deleting coupon:", error)
            alert("Error al eliminar el cupón")
        }
    }

    async function handleToggleStatus(id: string, currentStatus: boolean) {
        try {
            await toggleCouponStatus(id, !currentStatus)
            loadCoupons()
        } catch (error) {
            console.error("Error toggling status:", error)
            alert("Error al cambiar el estado")
        }
    }

    function formatCouponType(type: string) {
        const types: Record<string, string> = {
            percentage: "Porcentaje",
            fixed: "Valor Fijo",
            free_shipping: "Envío Gratis"
        }
        return types[type] || type
    }

    function formatCouponValue(coupon: Coupon) {
        if (coupon.type === 'percentage') return `${coupon.value}%`
        if (coupon.type === 'fixed') return `$${coupon.value.toLocaleString()}`
        return 'Envío Gratis'
    }

    function formatDate(dateString: string | null) {
        if (!dateString) return 'Sin límite'
        return new Date(dateString).toLocaleDateString('es-CO')
    }

    if (loading) {
        return <div className="flex items-center justify-center h-64">Cargando...</div>
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/marketing" className="text-text-light-secondary dark:text-text-dark-secondary hover:text-primary">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Link>
                    <div>
                        <h1 className="text-text-light-primary dark:text-text-dark-primary text-3xl font-bold tracking-tight">
                            Cupones de Descuento
                        </h1>
                        <p className="text-text-light-secondary dark:text-text-dark-secondary text-base mt-1">
                            Gestiona cupones y códigos promocionales
                        </p>
                    </div>
                </div>
                <Link
                    href="/dashboard/marketing/coupons/new"
                    className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-4 text-white text-sm font-bold shadow-sm hover:bg-primary/90"
                >
                    <span className="material-symbols-outlined text-lg">add</span>
                    <span>Crear Cupón</span>
                </Link>
            </div>

            {coupons.length === 0 ? (
                <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-12 text-center">
                    <span className="material-symbols-outlined text-6xl text-text-light-secondary dark:text-text-dark-secondary mb-4">confirmation_number</span>
                    <h3 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary mb-2">
                        No hay cupones creados
                    </h3>
                    <p className="text-text-light-secondary dark:text-text-dark-secondary mb-4">
                        Crea tu primer cupón de descuento para comenzar
                    </p>
                    <Link
                        href="/dashboard/marketing/coupons/new"
                        className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-4 text-white text-sm font-bold shadow-sm hover:bg-primary/90"
                    >
                        <span className="material-symbols-outlined text-lg">add</span>
                        <span>Crear Cupón</span>
                    </Link>
                </div>
            ) : (
                <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-background-light dark:bg-background-dark">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider">
                                        Código
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider">
                                        Tipo
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider">
                                        Descuento
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider">
                                        Usos
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider">
                                        Válido Hasta
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider">
                                        Estado
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-wider">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                {coupons.map((coupon) => (
                                    <tr key={coupon.id} className="hover:bg-background-light dark:hover:bg-background-dark">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="font-mono font-bold text-primary">{coupon.code}</div>
                                            </div>
                                            {coupon.description && (
                                                <div className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                                    {coupon.description}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light-primary dark:text-text-dark-primary">
                                            {formatCouponType(coupon.type)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-success">
                                            {formatCouponValue(coupon)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light-primary dark:text-text-dark-primary">
                                            {coupon.current_uses} / {coupon.max_uses || '∞'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light-primary dark:text-text-dark-primary">
                                            {formatDate(coupon.valid_until)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => handleToggleStatus(coupon.id, coupon.is_active)}
                                                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${coupon.is_active
                                                        ? 'bg-success/10 text-success'
                                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                                    }`}
                                            >
                                                {coupon.is_active ? 'Activo' : 'Inactivo'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/dashboard/marketing/coupons/${coupon.id}`}
                                                    className="text-primary hover:text-primary/80"
                                                >
                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(coupon.id)}
                                                    className="text-danger hover:text-danger/80"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
