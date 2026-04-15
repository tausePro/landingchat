"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Search, Image, Film, Upload, Check, Loader2 } from "lucide-react"
import { listMediaFiles, uploadMediaFile, type MediaFile } from "../actions"
import { MediaGrid } from "./MediaGrid"

interface MediaSelectorModalProps {
  open: boolean
  onClose: () => void
  onSelect: (urls: string[]) => void
  multiple?: boolean
  selectedUrls?: string[]
  acceptTypes?: ("image" | "video")[]
}

export function MediaSelectorModal({
  open,
  onClose,
  onSelect,
  multiple = true,
  selectedUrls: initialSelectedUrls = [],
  acceptTypes = ["image", "video"],
}: MediaSelectorModalProps) {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">("all")
  const [selectedUrls, setSelectedUrls] = useState<string[]>(initialSelectedUrls)
  const [uploading, setUploading] = useState(false)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    const result = await listMediaFiles()
    if (result.success) {
      setFiles(result.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (open) {
      loadFiles()
      setSelectedUrls(initialSelectedUrls)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSelect = (url: string) => {
    if (multiple) {
      setSelectedUrls((prev) =>
        prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
      )
    } else {
      setSelectedUrls([url])
    }
  }

  const handleConfirm = () => {
    onSelect(selectedUrls)
    onClose()
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setUploading(true)

    const uploadedUrls: string[] = []
    for (const file of Array.from(e.target.files)) {
      const result = await uploadMediaFile(file)
      if (result.success) {
        setFiles((prev) => [result.data, ...prev])
        uploadedUrls.push(result.data.publicUrl)
      }
    }

    // Auto-seleccionar los archivos recién subidos
    if (uploadedUrls.length > 0) {
      setSelectedUrls((prev) =>
        multiple ? [...prev, ...uploadedUrls] : [uploadedUrls[0]]
      )
    }

    setUploading(false)
    e.target.value = ""
  }

  // Filtrar archivos
  const filteredFiles = files.filter((f) => {
    if (!acceptTypes.includes(f.type)) return false
    if (typeFilter !== "all" && f.type !== typeFilter) return false
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[85vh] mx-4 bg-card-light dark:bg-card-dark rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light dark:border-border-dark shrink-0">
          <h2 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">
            Seleccionar Media
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="size-5 text-text-light-secondary dark:text-text-dark-secondary" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border-light dark:border-border-dark shrink-0">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-light-secondary dark:text-text-dark-secondary" />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Type filters */}
          {acceptTypes.length > 1 && (
            <div className="flex items-center gap-1 rounded-lg bg-background-light dark:bg-background-dark p-1">
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  typeFilter === "all"
                    ? "bg-primary text-white"
                    : "text-text-light-secondary dark:text-text-dark-secondary hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                Todos
              </button>
              {acceptTypes.includes("image") && (
                <button
                  type="button"
                  onClick={() => setTypeFilter("image")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    typeFilter === "image"
                      ? "bg-primary text-white"
                      : "text-text-light-secondary dark:text-text-dark-secondary hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <Image className="size-3.5" />
                  Imágenes
                </button>
              )}
              {acceptTypes.includes("video") && (
                <button
                  type="button"
                  onClick={() => setTypeFilter("video")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    typeFilter === "video"
                      ? "bg-primary text-white"
                      : "text-text-light-secondary dark:text-text-dark-secondary hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <Film className="size-3.5" />
                  Videos
                </button>
              )}
            </div>
          )}

          {/* Upload button */}
          <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 cursor-pointer transition-colors">
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {uploading ? "Subiendo..." : "Subir"}
            <input
              type="file"
              multiple
              accept={acceptTypes.map((t) => t === "image" ? "image/*" : "video/*").join(",")}
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-8 text-primary animate-spin" />
            </div>
          ) : (
            <MediaGrid
              files={filteredFiles}
              selectable
              selectedUrls={selectedUrls}
              onSelect={handleSelect}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border-light dark:border-border-dark shrink-0">
          <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
            {selectedUrls.length} archivo{selectedUrls.length !== 1 ? "s" : ""} seleccionado{selectedUrls.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border-light dark:border-border-dark text-text-light-primary dark:text-text-dark-primary hover:bg-background-light dark:hover:bg-background-dark transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedUrls.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="size-4" />
              Confirmar selección
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
