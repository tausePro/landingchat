"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { FormEvent, useTransition } from "react"

interface OrderFiltersProps {
    status: string
    search: string
    from: string
    to: string
}

const statusOptions = [
    { value: "all", label: "Todos los estados" },
    { value: "pending", label: "Pendiente" },
    { value: "confirmed", label: "Confirmado" },
    { value: "processing", label: "Procesando" },
    { value: "shipped", label: "Enviado" },
    { value: "delivered", label: "Entregado" },
    { value: "cancelled", label: "Cancelado" },
    { value: "refunded", label: "Reembolsado" },
]

export function OrderFilters({ status, search, from, to }: OrderFiltersProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const updateFilter = (name: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString())

        if (value.trim() && value !== "all") {
            params.set(name, value.trim())
        } else {
            params.delete(name)
        }

        params.delete("page")

        startTransition(() => {
            const query = params.toString()
            router.push(query ? `${pathname}?${query}` : pathname)
        })
    }

    const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        updateFilter("search", String(formData.get("search") || ""))
    }

    return (
        <div className="p-6 flex flex-col lg:flex-row gap-4 justify-between lg:items-center">
            <form onSubmit={handleSearchSubmit} className="relative w-full lg:max-w-xs">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-light-secondary dark:text-text-dark-secondary text-sm">search</span>
                <input
                    name="search"
                    className="form-input w-full rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary border-transparent h-10 placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary pl-10 pr-3 text-sm font-normal"
                    placeholder="Buscar por cliente o ID..."
                    defaultValue={search}
                    disabled={isPending}
                />
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 w-full lg:w-auto">
                <select
                    value={status}
                    onChange={(event) => updateFilter("status", event.target.value)}
                    disabled={isPending}
                    className="h-10 rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary border-transparent focus:outline-none focus:ring-2 focus:ring-primary text-sm px-3 disabled:opacity-60"
                >
                    {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>

                <input
                    type="date"
                    value={from}
                    onChange={(event) => updateFilter("from", event.target.value)}
                    disabled={isPending}
                    className="h-10 rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary border-transparent focus:outline-none focus:ring-2 focus:ring-primary text-sm px-3 disabled:opacity-60"
                    aria-label="Fecha inicial"
                />

                <input
                    type="date"
                    value={to}
                    onChange={(event) => updateFilter("to", event.target.value)}
                    disabled={isPending}
                    className="h-10 rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary border-transparent focus:outline-none focus:ring-2 focus:ring-primary text-sm px-3 disabled:opacity-60"
                    aria-label="Fecha final"
                />

                <Link
                    href="/dashboard/orders"
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-border-light dark:border-border-dark px-3 text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary hover:bg-background-light dark:hover:bg-background-dark"
                >
                    Limpiar
                </Link>
            </div>
        </div>
    )
}
