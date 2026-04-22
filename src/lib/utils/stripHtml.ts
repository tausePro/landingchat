export function stripHtml(value: string | null | undefined): string {
  if (!value) {
    return ""
  }

  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
