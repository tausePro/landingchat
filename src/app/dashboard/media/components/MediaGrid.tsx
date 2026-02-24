"use client"

import { useState, useRef, useEffect } from "react"
import { type MediaFile } from "../actions"
import { Trash2, Play, Check, ExternalLink, Copy, Pencil, X, Loader2 } from "lucide-react"

interface MediaGridProps {
  files: MediaFile[]
  selectable?: boolean
  selectedUrls?: string[]
  onSelect?: (url: string) => void
  onDelete?: (file: MediaFile) => void
  onRename?: (file: MediaFile, newName: string) => Promise<void>
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function MediaGrid({
  files,
  selectable = false,
  selectedUrls = [],
  onSelect,
  onDelete,
  onRename,
}: MediaGridProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [renaming, setRenaming] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const handleCopyUrl = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const startEditing = (file: MediaFile) => {
    // Quitar extensión para editar solo el nombre
    const nameWithoutExt = file.name.replace(/\.[^.]+$/, "")
    setEditValue(nameWithoutExt)
    setEditingId(file.id)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditValue("")
  }

  const confirmRename = async (file: MediaFile) => {
    if (!onRename || !editValue.trim()) {
      cancelEditing()
      return
    }
    setRenaming(true)
    await onRename(file, editValue.trim())
    setRenaming(false)
    setEditingId(null)
    setEditValue("")
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="material-symbols-outlined text-6xl text-text-light-secondary dark:text-text-dark-secondary mb-4">
          perm_media
        </span>
        <h3 className="text-lg font-medium text-text-light-primary dark:text-text-dark-primary">
          No hay archivos aún
        </h3>
        <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-1">
          Sube imágenes o videos para empezar a gestionar tu media.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {files.map((file) => {
        const isSelected = selectedUrls.includes(file.publicUrl)

        return (
          <div
            key={file.id}
            className={`group relative rounded-xl border-2 overflow-hidden transition-all cursor-pointer ${
              isSelected
                ? "border-primary ring-2 ring-primary/20"
                : "border-border-light dark:border-border-dark hover:border-primary/50"
            }`}
            onClick={() => {
              if (selectable && onSelect) {
                onSelect(file.publicUrl)
              }
            }}
          >
            {/* Preview */}
            <div className="aspect-square bg-background-light dark:bg-background-dark relative overflow-hidden">
              {file.type === "image" ? (
                <img
                  src={file.publicUrl}
                  alt={file.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                  <Play className="size-10 text-text-light-secondary dark:text-text-dark-secondary" />
                </div>
              )}

              {/* Selection indicator */}
              {selectable && isSelected && (
                <div className="absolute top-2 left-2 bg-primary text-white rounded-full p-1">
                  <Check className="size-4" />
                </div>
              )}

              {/* Hover overlay con acciones */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopyUrl(file.publicUrl, file.id)
                  }}
                  className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"
                  title="Copiar URL"
                >
                  {copiedId === file.id ? (
                    <Check className="size-4 text-green-600" />
                  ) : (
                    <Copy className="size-4 text-slate-700 dark:text-slate-300" />
                  )}
                </button>
                <a
                  href={file.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"
                  title="Abrir en nueva pestaña"
                >
                  <ExternalLink className="size-4 text-slate-700 dark:text-slate-300" />
                </a>
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(file)
                    }}
                    className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="size-4 text-red-500" />
                  </button>
                )}
              </div>
            </div>

            {/* File info */}
            <div className="p-2">
              {editingId === file.id ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmRename(file)
                      if (e.key === "Escape") cancelEditing()
                    }}
                    disabled={renaming}
                    className="flex-1 min-w-0 text-xs px-1.5 py-0.5 rounded border border-primary bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="nombre-seo-friendly"
                  />
                  {renaming ? (
                    <Loader2 className="size-3.5 text-primary animate-spin shrink-0" />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => confirmRename(file)}
                        className="p-0.5 text-green-600 hover:text-green-700 shrink-0"
                        title="Confirmar"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="p-0.5 text-red-500 hover:text-red-600 shrink-0"
                        title="Cancelar"
                      >
                        <X className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <p className="text-xs font-medium text-text-light-primary dark:text-text-dark-primary truncate flex-1" title={file.name}>
                    {file.name}
                  </p>
                  {onRename && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        startEditing(file)
                      }}
                      className="p-0.5 text-text-light-secondary dark:text-text-dark-secondary hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="Renombrar (SEO)"
                    >
                      <Pencil className="size-3" />
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-text-light-secondary dark:text-text-dark-secondary uppercase font-medium">
                  {file.type}
                </span>
                <span className="text-[10px] text-text-light-secondary dark:text-text-dark-secondary">
                  {formatFileSize(file.size)}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
