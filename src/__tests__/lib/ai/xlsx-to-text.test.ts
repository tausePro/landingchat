import { describe, it, expect } from "vitest"
import ExcelJS from "exceljs"
import { xlsxBufferToText } from "@/lib/ai/xlsx-to-text"

/** Construye un .xlsx en memoria y lo devuelve como Buffer. */
async function makeXlsx(build: (wb: ExcelJS.Workbook) => void): Promise<Buffer> {
    const wb = new ExcelJS.Workbook()
    build(wb)
    return (await wb.xlsx.writeBuffer()) as unknown as Buffer
}

describe("xlsxBufferToText", () => {
    it("extrae encabezado de hoja, celdas por ' | ' y filas por ' || '", async () => {
        const buf = await makeXlsx((wb) => {
            const ws = wb.addWorksheet("Catalogo")
            ws.addRow(["Producto", "Precio"])
            ws.addRow(["Camiseta", 50000])
        })

        const text = await xlsxBufferToText(buf)

        expect(text).toContain("HOJA Catalogo:")
        expect(text).toContain("Producto | Precio")
        expect(text).toContain("Camiseta | 50000")
        expect(text).toContain(" || ")
    })

    it("incluye el contenido de todas las hojas", async () => {
        const buf = await makeXlsx((wb) => {
            wb.addWorksheet("Uno").addRow(["alpha"])
            wb.addWorksheet("Dos").addRow(["beta"])
        })

        const text = await xlsxBufferToText(buf)

        expect(text).toContain("HOJA Uno:")
        expect(text).toContain("alpha")
        expect(text).toContain("HOJA Dos:")
        expect(text).toContain("beta")
    })

    it("omite filas completamente vacías (sin ' || ' consecutivos)", async () => {
        const buf = await makeXlsx((wb) => {
            const ws = wb.addWorksheet("X")
            ws.addRow(["fila1"])
            ws.addRow([])
            ws.addRow(["fila2"])
        })

        const text = await xlsxBufferToText(buf)

        expect(text).toContain("fila1")
        expect(text).toContain("fila2")
        expect(text).not.toMatch(/\|\|\s*\|\|/)
    })

    it("devuelve string vacío para un workbook sin hojas con datos", async () => {
        const buf = await makeXlsx((wb) => {
            wb.addWorksheet("Vacia")
        })

        const text = await xlsxBufferToText(buf)

        expect(text).toBe("HOJA Vacia:")
    })
})
