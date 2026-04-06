"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { exportProductsCsv, importProductsCsv } from "../actions"

export function ProductCsvTools() {
    const router = useRouter()
    const [exporting, setExporting] = useState(false)
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState<{ updated: number; errors: string[] } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleExport = async () => {
        setExporting(true)
        try {
            const result = await exportProductsCsv()
            if (!result.success) {
                alert(`Error: ${result.error}`)
                return
            }

            const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" })
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = `productos_${new Date().toISOString().split("T")[0]}.csv`
            link.click()
            URL.revokeObjectURL(url)
        } catch {
            alert("Error al exportar productos")
        } finally {
            setExporting(false)
        }
    }

    const handleImportClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.name.endsWith(".csv")) {
            alert("Solo se aceptan archivos .csv")
            return
        }

        setImporting(true)
        setImportResult(null)

        try {
            const text = await file.text()
            const result = await importProductsCsv(text)

            if (!result.success) {
                alert(`Error: ${result.error}`)
                return
            }

            setImportResult(result.data)
            router.refresh()
        } catch {
            alert("Error al importar productos")
        } finally {
            setImporting(false)
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    return (
        <>
            <button
                onClick={handleExport}
                disabled={exporting}
                className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-4 text-text-light-secondary dark:text-text-dark-secondary text-sm font-medium hover:bg-background-light dark:hover:bg-background-dark disabled:opacity-50"
                title="Exportar productos a CSV (se abre en Excel)"
            >
                <span className="material-symbols-outlined text-lg">download</span>
                <span className="truncate">{exporting ? "Exportando..." : "Exportar CSV"}</span>
            </button>

            <button
                onClick={handleImportClick}
                disabled={importing}
                className="flex h-10 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-4 text-text-light-secondary dark:text-text-dark-secondary text-sm font-medium hover:bg-background-light dark:hover:bg-background-dark disabled:opacity-50"
                title="Importar CSV editado para actualizar productos"
            >
                <span className="material-symbols-outlined text-lg">upload</span>
                <span className="truncate">{importing ? "Importando..." : "Importar CSV"}</span>
            </button>

            <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
            />

            {importResult && (
                <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="font-semibold text-text-light-primary dark:text-text-dark-primary">
                                <span className="material-symbols-outlined text-green-500 align-middle mr-1">check_circle</span>
                                {importResult.updated} productos actualizados
                            </p>
                            {importResult.errors.length > 0 && (
                                <div className="mt-2 text-xs text-danger">
                                    <p className="font-medium">{importResult.errors.length} errores:</p>
                                    <ul className="list-disc list-inside mt-1 max-h-24 overflow-y-auto">
                                        {importResult.errors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setImportResult(null)}
                            className="text-text-light-secondary hover:text-text-light-primary"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
