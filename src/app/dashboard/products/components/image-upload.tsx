"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { uploadProductImage } from "../actions"

interface ImageUploadProps {
    organizationId: string
    images: string[]
    onImagesChange: (images: string[]) => void
}

export function ImageUpload({ organizationId, images, onImagesChange }: ImageUploadProps) {
    const [uploading, setUploading] = useState(false)
    const [dragActive, setDragActive] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
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

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await handleFiles(e.dataTransfer.files)
        }
    }

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault()
        if (e.target.files && e.target.files[0]) {
            await handleFiles(e.target.files)
        }
    }

    const handleFiles = async (files: FileList) => {
        setUploading(true)
        try {
            const uploadPromises = Array.from(files).map(file =>
                uploadProductImage(file, organizationId)
            )
            const urls = await Promise.all(uploadPromises)
            onImagesChange([...images, ...urls])
        } catch (error: any) {
            alert(`Error al subir imagen: ${error.message}`)
        } finally {
            setUploading(false)
        }
    }

    const handleRemove = (index: number) => {
        const newImages = images.filter((_, i) => i !== index)
        onImagesChange(newImages)
    }

    return (
        <div className="space-y-4">
            <div
                className={`relative w-full h-48 flex justify-center items-center border-2 border-dashed rounded-lg cursor-pointer transition-colors ${dragActive
                        ? "border-primary bg-primary/5"
                        : "border-border-light dark:border-border-dark hover:border-primary"
                    }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleChange}
                    disabled={uploading}
                />
                <div className="flex flex-col items-center text-center text-muted-foreground">
                    <span className="material-symbols-outlined text-4xl">
                        {uploading ? "sync" : "cloud_upload"}
                    </span>
                    <p className="text-sm mt-1">
                        {uploading ? "Subiendo..." : (
                            <>Arrastra y suelta o <span className="text-primary font-semibold">haz clic para subir</span></>
                        )}
                    </p>
                    <p className="text-xs mt-1">PNG, JPG, GIF hasta 10MB</p>
                </div>
            </div>

            {images.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    {images.map((url, index) => (
                        <div key={index} className="relative group">
                            <img
                                src={url}
                                alt={`Product ${index + 1}`}
                                className="w-full aspect-square object-cover rounded-lg"
                            />
                            <button
                                type="button"
                                onClick={() => handleRemove(index)}
                                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
