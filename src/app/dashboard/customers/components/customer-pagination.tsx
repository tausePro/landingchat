"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

interface CustomerPaginationProps {
    currentPage: number
    totalPages: number
    total: number
    pageSize: number
}

export function CustomerPagination({
    currentPage,
    totalPages,
    total,
    pageSize,
}: CustomerPaginationProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const from = (currentPage - 1) * pageSize + 1
    const to = Math.min(currentPage * pageSize, total)

    const handlePageChange = (page: number) => {
        const params = new URLSearchParams(searchParams)
        params.set("page", page.toString())
        router.replace(`?${params.toString()}`)
    }

    return (
        <div className="flex items-center justify-between py-2">
            <span className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                Mostrando {from}-{to} de {total.toLocaleString("es-CO")}
            </span>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                >
                    Anterior
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                >
                    Siguiente
                </Button>
            </div>
        </div>
    )
}
