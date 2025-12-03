"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createCoupon, updateCoupon, getCouponById, CreateCouponData } from "../actions"

interface CouponFormProps {
    couponId?: string
}

export default function CouponForm({ couponId }: CouponFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const isEditing = !!couponId

    // Form state
    const [code, setCode] = useState("")
    const [description, setDescription] = useState("")
    const [type, setType] = useState<'percentage' | 'fixed' | 'free_shipping'>('percentage')
    const [value, setValue] = useState("")
    const [minPurchaseAmount, setMinPurchaseAmount] = useState("")
    const [maxDiscountAmount, setMaxDiscountAmount] = useState("")
    const [maxUses, setMaxUses] = useState("")
    const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState("1")
    const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0])
    const [validUntil, setValidUntil] = useState("")
    const [isActive, setIsActive] = useState(true)

    useEffect(() => {
        if (couponId) {
            loadCoupon()
        }
    }, [couponId])

    async function loadCoupon() {
        try {
            const coupon = await getCouponById(couponId!)
            if (coupon) {
                setCode(coupon.code)
                setDescription(coupon.description || "")
                setType(coupon.type)
                setValue(coupon.value.toString())
                setMinPurchaseAmount(coupon.min_purchase_amount?.toString() || "")
                setMaxDiscountAmount(coupon.max_discount_amount?.toString() || "")
                setMaxUses(coupon.max_uses?.toString() || "")
                setMaxUsesPerCustomer(coupon.max_uses_per_customer.toString())
                setValidFrom(coupon.valid_from.split('T')[0])
                setValidUntil(coupon.valid_until ? coupon.valid_until.split('T')[0] : "")
                setIsActive(coupon.is_active)
            }
        } catch (error) {
            console.error("Error loading coupon:", error)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!code.trim() || !value) {
            alert("El código y el valor son requeridos")
            return
        }

        setLoading(true)
        try {
            const couponData: CreateCouponData = {
                code: code.trim(),
                description: description.trim() || undefined,
                type,
                value: parseFloat(value),
                min_purchase_amount: minPurchaseAmount ? parseFloat(minPurchaseAmount) : undefined,
                max_discount_amount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : undefined,
                max_uses: maxUses ? parseInt(maxUses) : undefined,
                max_uses_per_customer: parseInt(maxUsesPerCustomer) || 1,
                valid_from: validFrom,
                valid_until: validUntil || undefined,
                is_active: isActive
            }

            if (isEditing) {
                await updateCoupon(couponId!, couponData)
            } else {
                await createCoupon(couponData)
            }

            router.push("/dashboard/marketing/coupons")
        } catch (error) {
            console.error("Error saving coupon:", error)
            alert("Error al guardar el cupón")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/dashboard/marketing/coupons" className="text-text-light-secondary dark:text-text-dark-secondary hover:text-primary">
                    <span className="material-symbols-outlined">arrow_back</span>
                </Link>
                <div>
                    <h1 className="text-text-light-primary dark:text-text-dark-primary text-3xl font-bold tracking-tight">
                        {isEditing ? "Editar Cupón" : "Crear Cupón"}
                    </h1>
                    <p className="text-text-light-secondary dark:text-text-dark-secondary text-base mt-1">
                        {isEditing ? "Modifica los detalles del cupón" : "Crea un nuevo cupón de descuento"}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Basic Information */}
                <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                    <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary mb-6">
                        Información Básica
                    </h2>

                    <div className="space-y-6">
                        <div>
                            <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                Código del Cupón
                            </label>
                            <input
                                type="text"
                                placeholder="DESCUENTO20"
                                value={code}
                                onChange={e => setCode(e.target.value.toUpperCase())}
                                className="form-input mt-2 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent font-mono"
                                required
                            />
                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                Código que los clientes usarán en el checkout
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                Descripción
                            </label>
                            <textarea
                                placeholder="Descripción del cupón..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={3}
                                className="form-textarea mt-2 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Discount Configuration */}
                <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                    <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary mb-6">
                        Configuración del Descuento
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                Tipo de Descuento
                            </label>
                            <select
                                value={type}
                                onChange={e => setType(e.target.value as any)}
                                className="form-select mt-2 block w-full rounded-lg bg-background-light dark:bg-background-dark border-transparent focus:border-primary focus:ring-primary text-text-light-primary dark:text-text-dark-primary"
                            >
                                <option value="percentage">Porcentaje</option>
                                <option value="fixed">Valor Fijo</option>
                                <option value="free_shipping">Envío Gratis</option>
                            </select>
                        </div>

                        {type !== 'free_shipping' && (
                            <div>
                                <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                    {type === 'percentage' ? 'Porcentaje (%)' : 'Valor (COP)'}
                                </label>
                                <div className="relative mt-2">
                                    {type === 'fixed' && (
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-light-secondary dark:text-text-dark-secondary">$</span>
                                    )}
                                    <input
                                        type="number"
                                        step={type === 'percentage' ? '1' : '100'}
                                        placeholder={type === 'percentage' ? '20' : '10000'}
                                        value={value}
                                        onChange={e => setValue(e.target.value)}
                                        className={`form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent ${type === 'fixed' ? 'pl-7' : ''}`}
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                Compra Mínima (COP)
                            </label>
                            <div className="relative mt-2">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-light-secondary dark:text-text-dark-secondary">$</span>
                                <input
                                    type="number"
                                    step="100"
                                    placeholder="50000"
                                    value={minPurchaseAmount}
                                    onChange={e => setMinPurchaseAmount(e.target.value)}
                                    className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent pl-7"
                                />
                            </div>
                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                Opcional. Monto mínimo para usar el cupón
                            </p>
                        </div>

                        {type === 'percentage' && (
                            <div>
                                <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                    Descuento Máximo (COP)
                                </label>
                                <div className="relative mt-2">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-light-secondary dark:text-text-dark-secondary">$</span>
                                    <input
                                        type="number"
                                        step="100"
                                        placeholder="100000"
                                        value={maxDiscountAmount}
                                        onChange={e => setMaxDiscountAmount(e.target.value)}
                                        className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent pl-7"
                                    />
                                </div>
                                <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                    Opcional. Límite máximo del descuento
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Usage Limits */}
                <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                    <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary mb-6">
                        Límites de Uso
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                Usos Totales
                            </label>
                            <input
                                type="number"
                                min="1"
                                placeholder="Ilimitado"
                                value={maxUses}
                                onChange={e => setMaxUses(e.target.value)}
                                className="form-input mt-2 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent"
                            />
                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                Deja vacío para usos ilimitados
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                Usos por Cliente
                            </label>
                            <input
                                type="number"
                                min="1"
                                placeholder="1"
                                value={maxUsesPerCustomer}
                                onChange={e => setMaxUsesPerCustomer(e.target.value)}
                                className="form-input mt-2 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent"
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Validity Period */}
                <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                    <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary mb-6">
                        Período de Validez
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                Válido Desde
                            </label>
                            <input
                                type="date"
                                value={validFrom}
                                onChange={e => setValidFrom(e.target.value)}
                                className="form-input mt-2 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                Válido Hasta
                            </label>
                            <input
                                type="date"
                                value={validUntil}
                                onChange={e => setValidUntil(e.target.value)}
                                className="form-input mt-2 w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent"
                            />
                            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                Deja vacío para sin fecha de expiración
                            </p>
                        </div>
                    </div>
                </div>

                {/* Status */}
                <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
                                Estado del Cupón
                            </h3>
                            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
                                {isActive ? 'El cupón está activo y puede ser usado' : 'El cupón está desactivado'}
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={isActive}
                                onChange={e => setIsActive(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/50 dark:peer-focus:ring-primary/80 rounded-full peer dark:bg-border-dark peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                        </label>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-4 text-white text-sm font-bold shadow-sm hover:bg-primary/90 disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-lg">save</span>
                        <span>{loading ? "Guardando..." : isEditing ? "Actualizar Cupón" : "Crear Cupón"}</span>
                    </button>
                    <Link
                        href="/dashboard/marketing/coupons"
                        className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-4 text-sm font-medium text-text-light-primary dark:text-text-dark-primary hover:bg-background-light dark:hover:bg-background-dark"
                    >
                        Cancelar
                    </Link>
                </div>
            </form>
        </div>
    )
}
