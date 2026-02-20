"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Image, Film, RefreshCw, Loader2, Trash2 } from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { listMediaFiles, deleteMediaFile, renameMediaFile, type MediaFile } from "./actions"
import { MediaGrid } from "./components/MediaGrid"
import { MediaUploader } from "./components/MediaUploader"

export default function MediaPage() {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">("all")
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<MediaFile | null>(null)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    const result = await listMediaFiles()
    if (result.success) {
      setFiles(result.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handleUploadComplete = (file: MediaFile) => {
    setFiles((prev) => [file, ...prev])
  }

  const handleDelete = async (file: MediaFile) => {
    setShowDeleteConfirm(file)
  }

  const confirmDelete = async () => {
    if (!showDeleteConfirm) return
    setDeleting(showDeleteConfirm.id)

    const result = await deleteMediaFile(showDeleteConfirm.fullPath)
    if (result.success) {
      setFiles((prev) => prev.filter((f) => f.id !== showDeleteConfirm.id))
    } else {
      alert(`Error: ${result.error}`)
    }

    setDeleting(null)
    setShowDeleteConfirm(null)
  }

  const handleRename = async (file: MediaFile, newName: string) => {
    const result = await renameMediaFile(file.fullPath, newName)
    if (result.success) {
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? result.data : f))
      )
    } else {
      alert(`Error: ${result.error}`)
    }
  }

  // Filtrar archivos
  const filteredFiles = files.filter((f) => {
    if (typeFilter !== "all" && f.type !== typeFilter) return false
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const imageCount = files.filter((f) => f.type === "image").length
  const videoCount = files.filter((f) => f.type === "video").length

  return (
    <DashboardLayout>
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
            Media Manager
          </h1>
          <p className="text-text-light-secondary dark:text-text-dark-secondary text-base mt-1">
            Gestiona las imágenes y videos de tu tienda.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-text-light-secondary dark:text-text-dark-secondary">
          <span className="flex items-center gap-1">
            <Image className="size-4" /> {imageCount} imágenes
          </span>
          <span className="mx-1">·</span>
          <span className="flex items-center gap-1">
            <Film className="size-4" /> {videoCount} videos
          </span>
        </div>
      </div>

      {/* Upload Zone */}
      <MediaUploader onUploadComplete={handleUploadComplete} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
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
        <div className="flex items-center gap-1 rounded-lg bg-background-light dark:bg-background-dark p-1">
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              typeFilter === "all"
                ? "bg-primary text-white shadow-sm"
                : "text-text-light-secondary dark:text-text-dark-secondary hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            Todos ({files.length})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter("image")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              typeFilter === "image"
                ? "bg-primary text-white shadow-sm"
                : "text-text-light-secondary dark:text-text-dark-secondary hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Image className="size-3.5" />
            Imágenes ({imageCount})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter("video")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              typeFilter === "video"
                ? "bg-primary text-white shadow-sm"
                : "text-text-light-secondary dark:text-text-dark-secondary hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Film className="size-3.5" />
            Videos ({videoCount})
          </button>
        </div>

        {/* Refresh */}
        <button
          type="button"
          onClick={loadFiles}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-border-light dark:border-border-dark text-text-light-secondary dark:text-text-dark-secondary hover:bg-background-light dark:hover:bg-background-dark transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Grid */}
      {loading && files.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 text-primary animate-spin" />
        </div>
      ) : (
        <MediaGrid
          files={filteredFiles}
          onDelete={handleDelete}
          onRename={handleRename}
        />
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(null)}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-2xl shadow-2xl p-6 max-w-md mx-4 w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <Trash2 className="size-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">
                  Eliminar archivo
                </h3>
                <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-background-light dark:bg-background-dark mb-6">
              {showDeleteConfirm.type === "image" ? (
                <img
                  src={showDeleteConfirm.publicUrl}
                  alt={showDeleteConfirm.name}
                  className="size-12 object-cover rounded-lg"
                />
              ) : (
                <div className="size-12 flex items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700">
                  <Film className="size-6 text-text-light-secondary" />
                </div>
              )}
              <p className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary truncate flex-1">
                {showDeleteConfirm.name}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border-light dark:border-border-dark text-text-light-primary dark:text-text-dark-primary hover:bg-background-light dark:hover:bg-background-dark transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting !== null}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </DashboardLayout>
  )
}
