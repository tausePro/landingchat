"use client"

import { useState, useRef, useCallback } from "react"
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { createSignedUploadUrl, type MediaFile } from "../actions"
import { createClient } from "@/lib/supabase/client"

interface MediaUploaderProps {
  onUploadComplete: (file: MediaFile) => void
}

interface UploadItem {
  file: File
  status: "pending" | "uploading" | "success" | "error"
  error?: string
  result?: MediaFile
}

export function MediaUploader({ onUploadComplete }: MediaUploaderProps) {
  const [dragActive, setDragActive] = useState(false)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const processFiles = useCallback(async (fileList: FileList) => {
    const newItems: UploadItem[] = Array.from(fileList).map((file) => ({
      file,
      status: "pending" as const,
    }))

    setUploads((prev) => [...newItems, ...prev])

    // Subir archivos secuencialmente para no sobrecargar
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i]

      setUploads((prev) =>
        prev.map((u) =>
          u.file === item.file ? { ...u, status: "uploading" } : u
        )
      )

      // Upload directo a Supabase para evitar límite de body de Next.js
      try {
        const urlResult = await createSignedUploadUrl(item.file.name, item.file.type)
        if (!urlResult.success) {
          setUploads((prev) =>
            prev.map((u) =>
              u.file === item.file
                ? { ...u, status: "error", error: urlResult.error }
                : u
            )
          )
          continue
        }

        const { token, path, publicUrl, fileName } = urlResult.data
        const supabase = createClient()
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .uploadToSignedUrl(path, token, item.file, { contentType: item.file.type })

        if (uploadError) {
          setUploads((prev) =>
            prev.map((u) =>
              u.file === item.file
                ? { ...u, status: "error", error: uploadError.message }
                : u
            )
          )
          continue
        }

        const ext = item.file.name.split(".").pop()?.toLowerCase() || ""
        const isVideo = ["mp4", "mov", "webm", "avi"].includes(ext)
        const mediaFile: MediaFile = {
          id: path,
          name: fileName,
          fullPath: path,
          publicUrl,
          type: isVideo ? "video" : "image",
          size: item.file.size,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        setUploads((prev) =>
          prev.map((u) =>
            u.file === item.file
              ? { ...u, status: "success", result: mediaFile }
              : u
          )
        )
        onUploadComplete(mediaFile)
      } catch (err) {
        setUploads((prev) =>
          prev.map((u) =>
            u.file === item.file
              ? { ...u, status: "error", error: err instanceof Error ? err.message : "Error al subir" }
              : u
          )
        )
      }
    }
  }, [onUploadComplete])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        await processFiles(e.dataTransfer.files)
      }
    },
    [processFiles]
  )

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        await processFiles(e.target.files)
        // Reset input para permitir re-subir el mismo archivo
        if (inputRef.current) inputRef.current.value = ""
      }
    },
    [processFiles]
  )

  const clearCompleted = () => {
    setUploads((prev) => prev.filter((u) => u.status === "uploading" || u.status === "pending"))
  }

  const hasCompleted = uploads.some((u) => u.status === "success" || u.status === "error")

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all cursor-pointer ${
          dragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border-light dark:border-border-dark hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/mp4,video/webm,video/mov"
          onChange={handleFileInput}
          className="hidden"
        />
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-3">
            <Upload className="size-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
            {dragActive ? "Suelta los archivos aquí" : "Arrastra y suelta archivos"}
          </p>
          <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">
            o <span className="text-primary font-semibold">haz clic para seleccionar</span>
          </p>
          <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-2">
            Imágenes (JPG, PNG, WebP, SVG, GIF) hasta 5MB — Videos (MP4, WebM, MOV) hasta 25MB
          </p>
        </div>
      </div>

      {/* Upload progress list */}
      {uploads.length > 0 && (
        <div className="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border-light dark:border-border-dark">
            <span className="text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary">
              {uploads.filter((u) => u.status === "success").length}/{uploads.length} archivos subidos
            </span>
            {hasCompleted && (
              <button
                type="button"
                onClick={clearCompleted}
                className="text-xs text-primary hover:text-primary/80 font-medium"
              >
                Limpiar lista
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-border-light dark:divide-border-dark">
            {uploads.map((item, idx) => (
              <div key={`${item.file.name}-${idx}`} className="flex items-center gap-3 px-4 py-2">
                <div className="shrink-0">
                  {item.status === "uploading" || item.status === "pending" ? (
                    <Loader2 className="size-4 text-primary animate-spin" />
                  ) : item.status === "success" ? (
                    <CheckCircle className="size-4 text-green-500" />
                  ) : (
                    <AlertCircle className="size-4 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-light-primary dark:text-text-dark-primary truncate">
                    {item.file.name}
                  </p>
                  {item.error && (
                    <p className="text-[10px] text-red-500 truncate">{item.error}</p>
                  )}
                </div>
                <span className="text-[10px] text-text-light-secondary dark:text-text-dark-secondary shrink-0">
                  {(item.file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
