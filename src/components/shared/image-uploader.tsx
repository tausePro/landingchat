"use client"

import { useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

interface ImageUploaderProps {
    organizationId: string
    bucketName: string
    folderPath?: string
    label?: string
    currentImageUrl?: string
    onUploadComplete?: (url: string) => void
    className?: string
}

export function ImageUploader({
    organizationId,
    bucketName,
    folderPath = "",
    label = "Imagen",
    currentImageUrl,
    onUploadComplete,
    className
}: ImageUploaderProps) {
    const [uploading, setUploading] = useState(false)
    const [preview, setPreview] = useState<string | null>(currentImageUrl || null)
    const [error, setError] = useState<string | null>(null)

    const supabase = createClient()

    const uploadImage = useCallback(async (file: File) => {
        setError(null)

        // Validate file type
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
        if (!validTypes.includes(file.type)) {
            setError('Formato no válido. Usa PNG, JPG, SVG o WEBP.')
            return
        }

        // Validate file size (2MB max)
        if (file.size > 2 * 1024 * 1024) {
            setError('El archivo es muy grande. Máximo 2MB.')
            return
        }

        setUploading(true)

        try {
            // Create unique filename
            const fileExt = file.name.split('.').pop()
            const fileName = `${organizationId}-${Date.now()}.${fileExt}`
            const fullPath = folderPath ? `${folderPath}/${fileName}` : fileName

            // Upload to Supabase Storage
            const { data, error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(fullPath, file, {
                    cacheControl: '3600',
                    upsert: false
                })

            if (uploadError) throw uploadError

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from(bucketName)
                .getPublicUrl(fullPath)

            setPreview(publicUrl)
            onUploadComplete?.(publicUrl)
        } catch (err) {
            console.error('Error uploading image:', err)
            setError('Error al subir la imagen. Intenta de nuevo.')
        } finally {
            setUploading(false)
        }
    }, [organizationId, bucketName, folderPath, onUploadComplete, supabase])

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) uploadImage(file)
    }, [uploadImage])

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) uploadImage(file)
    }, [uploadImage])

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {label}
            </p>

            {preview ? (
                <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-8">
                    <img src={preview} alt="Preview" className="h-24 w-24 object-cover rounded-full border" />
                    <button
                        type="button"
                        onClick={() => setPreview(null)}
                        className="text-sm font-medium text-primary hover:underline"
                    >
                        Cambiar imagen
                    </button>
                </div>
            ) : (
                <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="flex w-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 dark:border-slate-600 dark:bg-slate-800 transition-colors hover:border-primary dark:hover:border-primary cursor-pointer"
                >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                        <span className="material-symbols-outlined text-3xl text-slate-500 dark:text-slate-400">
                            {uploading ? 'progress_activity' : 'cloud_upload'}
                        </span>
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {uploading ? 'Subiendo...' : 'Arrastra y suelta aquí'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Recomendado: 200x200px (máx. 2MB)
                        </p>
                    </div>
                    <label className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 cursor-pointer">
                        O selecciona un archivo
                        <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                            onChange={handleFileInput}
                            className="hidden"
                            disabled={uploading}
                        />
                    </label>
                </div>
            )}

            {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
        </div>
    )
}
