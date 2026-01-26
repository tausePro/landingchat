"use client"

import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

interface CustomerImageUploadProps {
    organizationSlug: string
    acceptFormats?: string[]  // ["png", "jpg", "svg"]
    maxFileSizeMb?: number    // 5
    placeholder?: string
    value?: string
    onChange: (url: string | undefined) => void
    disabled?: boolean
}

export function CustomerImageUpload({
    organizationSlug,
    acceptFormats = ["png", "jpg", "jpeg", "gif", "svg", "webp"],
    maxFileSizeMb = 5,
    placeholder = "Sube tu imagen o logo",
    value,
    onChange,
    disabled = false
}: CustomerImageUploadProps) {
    const [uploading, setUploading] = useState(false)
    const [dragActive, setDragActive] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const acceptString = acceptFormats.map(f => `.${f}`).join(",")
    const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (disabled || uploading) return
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true)
        } else if (e.type === "dragleave") {
            setDragActive(false)
        }
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (disabled || uploading) return

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await handleFile(e.dataTransfer.files[0])
        }
    }

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault()
        if (disabled || uploading) return
        if (e.target.files && e.target.files[0]) {
            await handleFile(e.target.files[0])
        }
    }

    const handleFile = async (file: File) => {
        setError(null)

        // Validar formato
        const extension = file.name.split('.').pop()?.toLowerCase()
        if (!extension || !acceptFormats.includes(extension)) {
            setError(`Formato no permitido. Usa: ${acceptFormats.join(", ")}`)
            return
        }

        // Validar tamaño
        if (file.size > maxFileSizeBytes) {
            setError(`Archivo muy grande. Máximo: ${maxFileSizeMb}MB`)
            return
        }

        setUploading(true)
        try {
            const supabase = createClient()

            // Generar path único: org-slug/uuid.extension
            const fileExt = file.name.split('.').pop()
            const fileName = `${organizationSlug}/${crypto.randomUUID()}.${fileExt}`

            const { data, error: uploadError } = await supabase.storage
                .from("customer-uploads")
                .upload(fileName, file, {
                    cacheControl: "3600",
                    upsert: false
                })

            if (uploadError) {
                throw uploadError
            }

            // Obtener URL pública
            const { data: urlData } = supabase.storage
                .from("customer-uploads")
                .getPublicUrl(data.path)

            onChange(urlData.publicUrl)
        } catch (err: any) {
            console.error("Upload error:", err)
            setError("Error al subir imagen. Intenta de nuevo.")
        } finally {
            setUploading(false)
        }
    }

    const handleRemove = () => {
        onChange(undefined)
    }

    // Si ya hay imagen, mostrar preview
    if (value) {
        return (
            <div className="relative group">
                <img
                    src={value}
                    alt="Imagen subida"
                    className="w-full max-w-[200px] aspect-square object-contain rounded-lg border border-gray-200 bg-gray-50"
                />
                {!disabled && (
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <div
                className={`relative w-full h-32 flex justify-center items-center border-2 border-dashed rounded-lg cursor-pointer transition-colors ${disabled || uploading
                    ? "opacity-50 cursor-not-allowed"
                    : dragActive
                        ? "border-primary bg-primary/5"
                        : "border-gray-300 hover:border-primary"
                    }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => !disabled && !uploading && inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    className="hidden"
                    type="file"
                    accept={acceptString}
                    onChange={handleChange}
                    disabled={disabled || uploading}
                />
                <div className="flex flex-col items-center text-center text-gray-500 px-4">
                    <span className="material-symbols-outlined text-3xl">
                        {uploading ? "sync" : "cloud_upload"}
                    </span>
                    <p className="text-sm mt-1">
                        {uploading ? "Subiendo..." : placeholder}
                    </p>
                    <p className="text-xs mt-1 text-gray-400">
                        {acceptFormats.join(", ").toUpperCase()} • Máx {maxFileSizeMb}MB
                    </p>
                </div>
            </div>

            {error && (
                <p className="text-sm text-red-500">{error}</p>
            )}
        </div>
    )
}
