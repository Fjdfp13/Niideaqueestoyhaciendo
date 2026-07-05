import 'server-only'
import * as XLSX from 'xlsx'

const SHEET_EXPORT_URL = `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/export?format=xlsx`

export async function descargarWorkbook(): Promise<{ workbook: XLSX.WorkBook; buffer: ArrayBuffer }> {
  const res = await fetch(SHEET_EXPORT_URL, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`No se pudo descargar la hoja de Google Sheets (HTTP ${res.status})`)
  }
  const buffer = await res.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  return { workbook, buffer }
}

export function hojaComoFilas<T extends Record<string, unknown>>(
  workbook: XLSX.WorkBook,
  nombreHoja: string
): T[] {
  const ws = workbook.Sheets[nombreHoja]
  if (!ws) throw new Error(`La hoja "${nombreHoja}" no existe en el libro`)
  return XLSX.utils.sheet_to_json<T>(ws, { defval: null })
}

/** Convierte un número serial de Excel/Sheets a Date (UTC, sin hora). */
export function serialAFecha(serial: number): Date {
  const parsed = XLSX.SSF.parse_date_code(serial)
  return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
}

export function fechaAISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function restarDias(d: Date, dias: number): Date {
  const copia = new Date(d.getTime())
  copia.setUTCDate(copia.getUTCDate() - dias)
  return copia
}

/**
 * Dado un listado de filas con un campo de fecha serial, encuentra la fecha más reciente
 * que sea <= fechaObjetivo y devuelve esa fecha junto con todas las filas que la comparten.
 * Las hojas de este libro repiten el mismo Fecha_Corte en varias filas (una por canal/asesor).
 */
export function filasEnFechaMasReciente<T extends Record<string, unknown>>(
  filas: T[],
  campoFecha: keyof T,
  fechaObjetivo: Date
): { fecha: Date; filas: T[] } | null {
  const objetivoMs = fechaObjetivo.getTime()
  let mejorSerial: number | null = null

  for (const fila of filas) {
    const serial = fila[campoFecha]
    if (typeof serial !== 'number') continue
    const fecha = serialAFecha(serial)
    if (fecha.getTime() > objetivoMs) continue
    if (mejorSerial === null || serial > mejorSerial) mejorSerial = serial
  }

  if (mejorSerial === null) return null

  const filasFiltradas = filas.filter((fila) => fila[campoFecha] === mejorSerial)
  return { fecha: serialAFecha(mejorSerial), filas: filasFiltradas }
}

export function sumar<T>(filas: T[], campo: keyof T): number {
  return filas.reduce((acc, fila) => {
    const v = fila[campo]
    return acc + (typeof v === 'number' ? v : 0)
  }, 0)
}
