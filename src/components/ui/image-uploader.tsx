"use client"

import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Loader2, Upload, X } from "lucide-react"

interface ImageUploaderProps {
    currentImageUrl?: string
    onImageUploaded: (url: string) => void
    folder?: string
    maxSizeMB?: number
    acceptedFormats?: string[]
}

export function ImageUploader({
    currentImageUrl,
    onImageUploaded,
    folder = "hero",
    maxSizeMB = 5,
    acceptedFormats = ["image/jpeg", "image/png", "image/webp"]
}: ImageUploaderProps) {
    const [uploading, setUploading] = useState(false)
    const [preview, setPreview] = useState(currentImageUrl || "")
    const [error, setError] = useState("")
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validations
        if (!acceptedFormats.includes(file.type)) {
            setError(`Formato no válido. Usa: ${acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`)
            return
        }

        const fileSizeMB = file.size / (1024 * 1024)
        if (fileSizeMB > maxSizeMB) {
            setError(`Archivo muy grande. Máximo ${maxSizeMB}MB`)
            return
        }

        setError("")
        setUploading(true)

        try {
            const supabase = createClient()

            // Generate unique filename
            const fileExt = file.name.split('.').pop()
            const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

            // Upload to Supabase Storage
            const { data, error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                })

            if (uploadError) throw uploadError

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(data.path)

            setPreview(publicUrl)
            onImageUploaded(publicUrl)
        } catch (err: any) {
            console.error('Upload error:', err)
            setError(err.message || 'Error al subir la imagen')
        } finally {
            setUploading(false)
        }
    }

    const handleRemove = () => {
        setPreview("")
        onImageUploaded("")
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    return (
        <div className="space-y-4">
            {preview ? (
                <div className="relative group">
                    <div
                        className="w-full h-48 rounded-lg bg-cover bg-center border-2 border-gray-200 dark:border-gray-700"
                        style={{ backgroundImage: `url(${preview})` }}
                    />
                    <button
                        onClick={handleRemove}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        title="Eliminar imagen"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <div className="flex items-center justify-center w-full">
                    <label
                        htmlFor="image-upload"
                        className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 dark:border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {uploading ? (
                                <>
                                    <Loader2 className="w-10 h-10 text-primary mb-3 animate-spin" />
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Subiendo imagen...</p>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-10 h-10 text-gray-400 mb-3" />
                                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                                        <span className="font-semibold">Click para subir</span> o arrastra aquí
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        PNG, JPG, WEBP (MAX. {maxSizeMB}MB)
                                    </p>
                                </>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            id="image-upload"
                            type="file"
                            className="hidden"
                            accept={acceptedFormats.join(',')}
                            onChange={handleFileSelect}
                            disabled={uploading}
                        />
                    </label>
                </div>
            )}

            {error && (
                <p className="text-sm text-red-500">{error}</p>
            )}

            {preview && (
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1">
                        {preview.split('/').pop()}
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        Cambiar
                    </Button>
                </div>
            )}
        </div>
    )
}
