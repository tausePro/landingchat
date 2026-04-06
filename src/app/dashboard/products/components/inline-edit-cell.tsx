"use client"

import { useState, useRef, useEffect, useCallback } from "react"

interface InlineEditCellProps {
    value: number
    productId: string
    field: "price" | "stock" | "sale_price"
    onSave: (productId: string, field: string, value: number) => Promise<boolean>
    formatDisplay?: (value: number) => string
    inputType?: "currency" | "integer"
    className?: string
    placeholder?: string
}

export function InlineEditCell({
    value,
    productId,
    field,
    onSave,
    formatDisplay,
    inputType = "integer",
    className = "",
    placeholder,
}: InlineEditCellProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(value.toString())
    const [currentValue, setCurrentValue] = useState(value)
    const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle")
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setCurrentValue(value)
    }, [value])

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    // Reset success/error status after delay
    useEffect(() => {
        if (status === "success" || status === "error") {
            const timer = setTimeout(() => setStatus("idle"), 1500)
            return () => clearTimeout(timer)
        }
    }, [status])

    const handleStartEdit = () => {
        setEditValue(currentValue.toString())
        setIsEditing(true)
        setStatus("idle")
    }

    const handleCancel = useCallback(() => {
        setIsEditing(false)
        setEditValue(currentValue.toString())
    }, [currentValue])

    const handleSave = useCallback(async () => {
        const parsed = inputType === "currency"
            ? parseFloat(editValue.replace(/[^0-9.]/g, ""))
            : parseInt(editValue.replace(/[^0-9]/g, ""), 10)

        if (isNaN(parsed) || parsed < 0) {
            setStatus("error")
            setIsEditing(false)
            return
        }

        // No cambió → solo cerrar
        if (parsed === currentValue) {
            setIsEditing(false)
            return
        }

        setIsEditing(false)
        setStatus("saving")

        const ok = await onSave(productId, field, parsed)
        if (ok) {
            setCurrentValue(parsed)
            setStatus("success")
        } else {
            setStatus("error")
        }
    }, [editValue, currentValue, productId, field, onSave, inputType])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            handleSave()
        } else if (e.key === "Escape") {
            handleCancel()
        }
    }

    const displayValue = formatDisplay
        ? formatDisplay(currentValue)
        : currentValue.toString()

    const statusIcon =
        status === "saving" ? "hourglass_empty" :
        status === "success" ? "check_circle" :
        status === "error" ? "error" : null

    const statusColor =
        status === "success" ? "text-green-500" :
        status === "error" ? "text-red-500" :
        "text-text-light-secondary dark:text-text-dark-secondary animate-spin"

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="text"
                inputMode={inputType === "currency" ? "decimal" : "numeric"}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className="w-24 px-2 py-1 text-sm rounded-md border border-primary bg-white dark:bg-slate-900 text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder={placeholder}
            />
        )
    }

    return (
        <button
            onClick={handleStartEdit}
            className={`group inline-flex items-center gap-1 px-2 py-1 -mx-2 -my-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-text ${className}`}
            title="Click para editar"
        >
            <span className={status !== "idle" ? "opacity-60" : ""}>
                {displayValue}
            </span>
            {statusIcon ? (
                <span className={`material-symbols-outlined text-sm ${statusColor}`}>
                    {statusIcon}
                </span>
            ) : (
                <span className="material-symbols-outlined text-xs text-text-light-secondary/0 group-hover:text-text-light-secondary dark:group-hover:text-text-dark-secondary transition-colors">
                    edit
                </span>
            )}
        </button>
    )
}
