"use server"

import { createClient } from "@/lib/supabase/server"
import { type ActionResult, success, failure } from "@/types/common"

const BUCKET_NAME = "product-images"

// Tipos de archivo soportados
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"]
const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "avi"]
const ALL_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]

export interface MediaFile {
  id: string
  name: string
  fullPath: string
  publicUrl: string
  type: "image" | "video"
  size: number | null
  createdAt: string | null
  updatedAt: string | null
}

function getFileType(name: string): "image" | "video" {
  const ext = name.split(".").pop()?.toLowerCase() || ""
  if (VIDEO_EXTENSIONS.includes(ext)) return "video"
  return "image"
}

interface OrgInfo {
  id: string
  slug: string
}

/**
 * Obtiene el organization_id y slug del usuario actual
 */
async function getCurrentOrg(): Promise<ActionResult<OrgInfo>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return failure("No autorizado")

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) return failure("No se encontró organización")

  const { data: org } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", profile.organization_id)
    .single()

  return success({
    id: profile.organization_id,
    slug: org?.slug || "",
  })
}

/**
 * Lista todos los archivos media de la organización actual desde Supabase Storage
 */
export async function listMediaFiles(): Promise<ActionResult<MediaFile[]>> {
  try {
    const orgResult = await getCurrentOrg()
    if (!orgResult.success) return failure(orgResult.error)
    const { id: orgId, slug } = orgResult.data

    const supabase = await createClient()

    // Listar archivos por UUID (path estándar)
    const { data: filesByUuid, error: errorUuid } = await supabase.storage
      .from(BUCKET_NAME)
      .list(orgId, {
        limit: 500,
        sortBy: { column: "created_at", order: "desc" },
      })

    if (errorUuid) return failure(`Error listando archivos: ${errorUuid.message}`)

    // También listar por slug (algunas orgs tienen archivos bajo slug/ en vez de uuid/)
    let filesBySlug: typeof filesByUuid = []
    if (slug && slug !== orgId) {
      const { data } = await supabase.storage
        .from(BUCKET_NAME)
        .list(slug, {
          limit: 500,
          sortBy: { column: "created_at", order: "desc" },
        })
      filesBySlug = data || []
    }

    // Mapear archivos a MediaFile, indicando el prefijo correcto para cada uno
    const mapFiles = (rawFiles: typeof filesByUuid, prefix: string): MediaFile[] =>
      (rawFiles || [])  
        .filter((f) => {
          if (!f.name || f.name === ".emptyFolderPlaceholder") return false
          const ext = f.name.split(".").pop()?.toLowerCase() || ""
          return ALL_EXTENSIONS.includes(ext)
        })
        .map((f) => {
          const fullPath = `${prefix}/${f.name}`
          const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fullPath)

          return {
            id: f.id || fullPath,
            name: f.name,
            fullPath,
            publicUrl,
            type: getFileType(f.name),
            size: f.metadata?.size ?? null,
            createdAt: f.created_at || null,
            updatedAt: f.updated_at || null,
          }
        })

    const allFiles = [
      ...mapFiles(filesByUuid, orgId),
      ...mapFiles(filesBySlug, slug),
    ]

    // Deduplicar por nombre (si un archivo existe en ambas carpetas)
    const seen = new Set<string>()
    const dedupedFiles = allFiles.filter((f) => {
      if (seen.has(f.name)) return false
      seen.add(f.name)
      return true
    })

    return success(dedupedFiles)
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Error desconocido listando media")
  }
}

/**
 * Sube un archivo al bucket de la organización
 */
export async function uploadMediaFile(
  file: File
): Promise<ActionResult<MediaFile>> {
  try {
    const orgResult = await getCurrentOrg()
    if (!orgResult.success) return failure(orgResult.error)
    const orgId = orgResult.data.id

    // Validar extensión
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    if (!ALL_EXTENSIONS.includes(ext)) {
      return failure(`Tipo de archivo no soportado: .${ext}`)
    }

    // Validar tamaño (25MB máximo para videos, 5MB para imágenes)
    const maxSize = VIDEO_EXTENSIONS.includes(ext) ? 25 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024)
      return failure(`El archivo excede el límite de ${maxMB}MB`)
    }

    // Generar nombre único
    const timestamp = Date.now()
    const safeName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .toLowerCase()
    const fileName = `${timestamp}-${safeName}`
    const filePath = `${orgId}/${fileName}`

    const supabase = await createClient()

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (error) return failure(`Error subiendo archivo: ${error.message}`)

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path)

    const mediaFile: MediaFile = {
      id: data.path,
      name: fileName,
      fullPath: data.path,
      publicUrl,
      type: getFileType(fileName),
      size: file.size,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return success(mediaFile)
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Error desconocido subiendo archivo")
  }
}

/**
 * Renombra un archivo en el bucket (copy + delete, Supabase no tiene rename nativo)
 * El nuevo nombre se sanitiza para SEO (lowercase, sin caracteres especiales)
 */
export async function renameMediaFile(
  fullPath: string,
  newName: string
): Promise<ActionResult<MediaFile>> {
  try {
    const orgResult = await getCurrentOrg()
    if (!orgResult.success) return failure(orgResult.error)
    const { id: orgId, slug } = orgResult.data

    // Seguridad: verificar que el path pertenece a la org (por UUID o slug)
    const prefix = fullPath.split("/")[0]
    if (prefix !== orgId && prefix !== slug) {
      return failure("No tienes permiso para renombrar este archivo")
    }

    if (!newName.trim()) return failure("El nombre no puede estar vacío")

    // Preservar extensión original
    const originalExt = fullPath.split(".").pop()?.toLowerCase() || ""

    // Sanitizar nombre para SEO: lowercase, sin acentos, solo alfanuméricos y guiones
    const sanitized = newName
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
      .replace(/[^a-z0-9.-]/g, "-") // Solo alfanuméricos y guiones
      .replace(/-+/g, "-") // Colapsar guiones múltiples
      .replace(/^-|-$/g, "") // Quitar guiones al inicio/final

    if (!sanitized) return failure("El nombre resultante no es válido")

    // Agregar extensión si el usuario no la incluyó
    const hasExtension = sanitized.endsWith(`.${originalExt}`)
    const newFileName = hasExtension ? sanitized : `${sanitized}.${originalExt}`
    // Mantener el mismo prefijo (slug o uuid) del archivo original
    const newPath = `${prefix}/${newFileName}`

    // No hacer nada si el nombre es el mismo
    if (newPath === fullPath) return failure("El nombre es igual al actual")

    const supabase = await createClient()

    // Descargar archivo original
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(fullPath)

    if (downloadError) return failure(`Error descargando archivo: ${downloadError.message}`)

    // Subir con nuevo nombre
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(newPath, fileData, {
        contentType: fileData.type,
        upsert: false,
      })

    if (uploadError) {
      if (uploadError.message.includes("already exists")) {
        return failure("Ya existe un archivo con ese nombre")
      }
      return failure(`Error subiendo archivo renombrado: ${uploadError.message}`)
    }

    // Eliminar archivo original
    await supabase.storage.from(BUCKET_NAME).remove([fullPath])

    // Generar URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(newPath)

    return success({
      id: newPath,
      name: newFileName,
      fullPath: newPath,
      publicUrl,
      type: getFileType(newFileName),
      size: fileData.size,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Error desconocido renombrando archivo")
  }
}

/**
 * Elimina un archivo del bucket de la organización
 */
export async function deleteMediaFile(
  fullPath: string
): Promise<ActionResult<void>> {
  try {
    const orgResult = await getCurrentOrg()
    if (!orgResult.success) return failure(orgResult.error)
    const { id: orgId, slug } = orgResult.data

    // Seguridad: verificar que el path pertenece a la org (por UUID o slug)
    const prefix = fullPath.split("/")[0]
    if (prefix !== orgId && prefix !== slug) {
      return failure("No tienes permiso para eliminar este archivo")
    }

    const supabase = await createClient()

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([fullPath])

    if (error) return failure(`Error eliminando archivo: ${error.message}`)

    return success(undefined)
  } catch (err) {
    return failure(err instanceof Error ? err.message : "Error desconocido eliminando archivo")
  }
}
