"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { ProductStatusToggle } from "./product-status-toggle"
import { DeleteProductButton } from "./delete-product-button"
import { InlineEditCell } from "./inline-edit-cell"
import { quickUpdateProduct } from "../actions"
import { ProductData } from "@/types/product"
import { formatCurrency as formatTenantCurrency } from "@/lib/utils"
import { type TenantLocaleContext, DEFAULT_TENANT_LOCALE } from "@/lib/i18n/tenant-locale"

interface ProductTableProps {
    products: ProductData[]
    tenantLocale?: TenantLocaleContext
}

const getProductImage = (product: ProductData): string | null =>
    product.images?.[0] || product.image_url || null

type StatusFilter = "all" | "active" | "inactive" | "out_of_stock"

export function ProductTable({ products, tenantLocale = DEFAULT_TENANT_LOCALE }: ProductTableProps) {
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
    const formatCurrency = (amount: number) =>
        formatTenantCurrency(amount, { currency: tenantLocale.currency, locale: tenantLocale.locale })

    const handleInlineSave = useCallback(
        async (productId: string, field: string, value: number): Promise<boolean> => {
            const result = await quickUpdateProduct(
                productId,
                field as "price" | "stock" | "sale_price",
                value
            )
            return result.success
        },
        []
    )

    const filtered = useMemo(() => {
        return products.filter((p) => {
            const q = search.toLowerCase()
            const matchesSearch =
                !q ||
                p.name.toLowerCase().includes(q) ||
                p.description?.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q)

            const isActive = p.is_active ?? true
            const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "active" && isActive && p.stock > 0) ||
                (statusFilter === "inactive" && !isActive) ||
                (statusFilter === "out_of_stock" && p.stock === 0)

            return matchesSearch && matchesStatus
        })
    }, [products, search, statusFilter])

    const counts = useMemo(() => {
        const active = products.filter((p) => (p.is_active ?? true) && p.stock > 0).length
        const inactive = products.filter((p) => !(p.is_active ?? true)).length
        const outOfStock = products.filter((p) => p.stock === 0).length
        return { all: products.length, active, inactive, outOfStock }
    }, [products])

    return (
        <div className="mt-8 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 sm:p-6 flex flex-wrap items-center gap-3">
                <label className="relative flex items-center flex-1 min-w-[200px] max-w-sm">
                    <span className="material-symbols-outlined absolute left-3 text-text-light-secondary dark:text-text-dark-secondary text-xl">
                        search
                    </span>
                    <input
                        className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent h-10 placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary pl-10 text-sm font-normal"
                        placeholder="Buscar por nombre o SKU..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </label>
                <div className="flex items-center gap-1.5 text-sm">
                    {([
                        { key: "all" as StatusFilter, label: "Todos", count: counts.all },
                        { key: "active" as StatusFilter, label: "Activos", count: counts.active },
                        { key: "inactive" as StatusFilter, label: "Inactivos", count: counts.inactive },
                        { key: "out_of_stock" as StatusFilter, label: "Sin stock", count: counts.outOfStock },
                    ]).map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setStatusFilter(f.key)}
                            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                                statusFilter === f.key
                                    ? "bg-primary/10 text-primary"
                                    : "text-text-light-secondary dark:text-text-dark-secondary hover:bg-background-light dark:hover:bg-background-dark"
                            }`}
                        >
                            {f.label} ({f.count})
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="w-full overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-text-light-secondary dark:text-text-dark-secondary uppercase bg-background-light dark:bg-background-dark">
                        <tr>
                            <th className="px-6 py-3" scope="col">Producto</th>
                            <th className="px-6 py-3" scope="col">SKU</th>
                            <th className="px-6 py-3" scope="col">Precio</th>
                            <th className="px-6 py-3" scope="col">Stock</th>
                            <th className="px-6 py-3" scope="col">Estado</th>
                            <th className="px-6 py-3 text-right" scope="col">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr className="border-b border-border-light dark:border-border-dark">
                                <td
                                    colSpan={6}
                                    className="px-6 py-12 text-center text-text-light-secondary dark:text-text-dark-secondary"
                                >
                                    <span className="material-symbols-outlined text-4xl mb-2 block opacity-40">
                                        inventory_2
                                    </span>
                                    {search || statusFilter !== "all"
                                        ? "No se encontraron productos con esos filtros"
                                        : "No hay productos aún"}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((product) => {
                                const img = getProductImage(product)
                                const hasDiscount = product.sale_price && product.sale_price < product.price

                                return (
                                    <tr
                                        key={product.id}
                                        className="border-b border-border-light dark:border-border-dark hover:bg-background-light/50 dark:hover:bg-background-dark/50"
                                    >
                                        {/* Producto con imagen */}
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="size-12 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                    {img ? (
                                                        <img
                                                            src={img}
                                                            alt={product.name}
                                                            className="size-full object-cover"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = "none"
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="size-full flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-xl text-slate-400">
                                                                image
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <Link
                                                        href={`/dashboard/products/${product.id}`}
                                                        className="font-medium text-text-light-primary dark:text-text-dark-primary hover:text-primary line-clamp-1"
                                                    >
                                                        {product.name}
                                                    </Link>
                                                    {product.categories && product.categories.length > 0 && (
                                                        <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary line-clamp-1">
                                                            {product.categories.join(", ")}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* SKU */}
                                        <td className="px-6 py-3 text-text-light-secondary dark:text-text-dark-secondary whitespace-nowrap">
                                            {product.sku || "-"}
                                        </td>

                                        {/* Precio (inline edit) */}
                                        <td className="px-6 py-3 whitespace-nowrap">
                                            <div className="flex flex-col gap-0.5">
                                                <InlineEditCell
                                                    value={product.price}
                                                    productId={product.id}
                                                    field="price"
                                                    onSave={handleInlineSave}
                                                    formatDisplay={formatCurrency}
                                                    inputType="currency"
                                                    className="font-semibold"
                                                />
                                                {hasDiscount && (
                                                    <InlineEditCell
                                                        value={product.sale_price!}
                                                        productId={product.id}
                                                        field="sale_price"
                                                        onSave={handleInlineSave}
                                                        formatDisplay={(v) => `↓ ${formatCurrency(v)}`}
                                                        inputType="currency"
                                                        className="text-xs text-primary"
                                                    />
                                                )}
                                            </div>
                                        </td>

                                        {/* Stock (inline edit) */}
                                        <td className="px-6 py-3 whitespace-nowrap">
                                            <InlineEditCell
                                                value={product.stock}
                                                productId={product.id}
                                                field="stock"
                                                onSave={handleInlineSave}
                                                className={`font-medium ${
                                                    product.stock === 0
                                                        ? "text-danger"
                                                        : product.stock <= 5
                                                          ? "text-amber-600 dark:text-amber-400"
                                                          : ""
                                                }`}
                                            />
                                        </td>

                                        {/* Estado */}
                                        <td className="px-6 py-3">
                                            <ProductStatusToggle
                                                productId={product.id}
                                                isActive={product.is_active ?? true}
                                            />
                                        </td>

                                        {/* Acciones */}
                                        <td className="px-6 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link
                                                    href={`/dashboard/products/${product.id}`}
                                                    className="p-2 rounded-lg text-text-light-secondary dark:text-text-dark-secondary hover:text-primary hover:bg-primary/5"
                                                    title="Editar"
                                                >
                                                    <span className="material-symbols-outlined text-xl">edit</span>
                                                </Link>
                                                <DeleteProductButton
                                                    productId={product.id}
                                                    productName={product.name}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-6 flex items-center justify-between">
                <span className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                    Mostrando{" "}
                    <span className="font-semibold text-text-light-primary dark:text-text-dark-primary">
                        {filtered.length}
                    </span>{" "}
                    de{" "}
                    <span className="font-semibold text-text-light-primary dark:text-text-dark-primary">
                        {products.length}
                    </span>{" "}
                    productos
                </span>
            </div>
        </div>
    )
}
