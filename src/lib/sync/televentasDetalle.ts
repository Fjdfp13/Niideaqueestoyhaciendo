import 'server-only'
import { descargarWorkbook, fechaAISO, filasEnFechaMasReciente, hojaComoFilas, serialAFecha, sumar } from './workbook'
import type { PuntoPulso } from '@/components/PulseChart'

export const META_INDIVIDUAL_JAC = 2
export const META_TOTAL_JAC = 16

type FilaTVJAC = {
  Fecha_Corte: number
  Semana_Mes: number
  Asesor: string
  Ventas_Acum_Mes: number
  Ingresos_Acum_Mes_USD: number
}

type FilaTVSeguros = {
  Fecha_Corte: number
  Semana_Mes: number
  Asesor: string
  Ventas_Acum_Mes: number
  Ingresos_Acum_Mes_USD: number
}

type FilaTVSmartbuy = {
  Fecha_Corte: number
  Semana_Mes: number
  Asesor: string
  Ventas_Acum_Mes: number
  Articulos_Acum_Mes: number
  Ingresos_Acum_Mes_USD: number
}

type FilaTVFibex = {
  Fecha_Corte: number
  Semana_Mes: number
  Vendedor: string
  Ventas_Hogar: number
  Ventas_Pymes: number
  Total_Ventas: number
  Total_Monto_USD: number
}

const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function etiquetaFecha(serial: number): string {
  const fecha = serialAFecha(serial)
  return `${String(fecha.getUTCDate()).padStart(2, '0')}-${MESES_CORTO[fecha.getUTCMonth()]}`
}

function pulsoPorSemana<T extends Record<string, unknown>>(
  filas: T[],
  campoSemana: keyof T,
  campoValor: keyof T,
  campoFecha: keyof T
): PuntoPulso[] {
  const grupos = new Map<number, T[]>()
  for (const f of filas) {
    const sm = f[campoSemana]
    if (typeof sm !== 'number') continue
    const grupo = grupos.get(sm) ?? []
    grupo.push(f)
    grupos.set(sm, grupo)
  }
  return [...grupos.keys()]
    .sort((a, b) => a - b)
    .map((sm) => {
      const filasSemana = grupos.get(sm)!
      const serial = filasSemana.find((f) => typeof f[campoFecha] === 'number')?.[campoFecha] as number | undefined
      return {
        valor: sumar(filasSemana, campoValor),
        etiqueta: serial ? etiquetaFecha(serial) : `S${sm}`,
      }
    })
}

function tendencia(pulso: PuntoPulso[]): { texto: string; tono: 'ok' | 'warn' | 'bad' } {
  if (pulso.length < 2) return { texto: '—', tono: 'warn' }
  const delta = pulso[pulso.length - 1].valor - pulso[pulso.length - 2].valor
  if (delta > 0) return { texto: 'Creciente', tono: 'ok' }
  if (delta < 0) return { texto: 'Decreciente', tono: 'bad' }
  return { texto: 'Estancado', tono: 'warn' }
}

export type DetalleTeleventas = {
  fechaCorte: string | null
  jac: {
    unidades: number
    ingresos: number
    pulso: PuntoPulso[]
    vendedores: { nombre: string; unidades: number; ingresos: number; pctMeta: number }[]
    brecha: number
  } | null
  fibex: {
    ventas: number
    monto: number
    arpu: number
    hogar: number
    pymes: number
    vendedoresActivos: number
    top: { nombre: string; ventas: number; monto: number; arpu: number }[]
    pulso: PuntoPulso[]
  } | null
  seguros: {
    polizas: number
    ingresos: number
    top: { nombre: string; polizas: number; monto: number }[]
    pulso: PuntoPulso[]
  } | null
  smartbuy: {
    ventas: number
    articulos: number
    ingresos: number
    asesores: { nombre: string; ventas: number; monto: number }[]
    pulso: PuntoPulso[]
  } | null
}

export async function calcularDetalleTeleventas(): Promise<DetalleTeleventas> {
  const { workbook } = await descargarWorkbook()
  const hoy = new Date()

  const filasJac = hojaComoFilas<FilaTVJAC>(workbook, 'BD_Televentas_JAC')
  const ultimaJac = filasEnFechaMasReciente(filasJac, 'Fecha_Corte', hoy)
  const jac = ultimaJac
    ? {
        unidades: sumar(ultimaJac.filas, 'Ventas_Acum_Mes'),
        ingresos: sumar(ultimaJac.filas, 'Ingresos_Acum_Mes_USD'),
        pulso: pulsoPorSemana(filasJac, 'Semana_Mes', 'Ventas_Acum_Mes', 'Fecha_Corte'),
        vendedores: ultimaJac.filas
          .slice()
          .sort((a, b) => b.Ventas_Acum_Mes - a.Ventas_Acum_Mes)
          .map((f) => ({
            nombre: f.Asesor,
            unidades: f.Ventas_Acum_Mes,
            ingresos: f.Ingresos_Acum_Mes_USD,
            pctMeta: f.Ventas_Acum_Mes / META_INDIVIDUAL_JAC,
          })),
        brecha: Math.max(META_TOTAL_JAC - sumar(ultimaJac.filas, 'Ventas_Acum_Mes'), 0),
      }
    : null
  if (jac) jac.pulso.push({ valor: META_TOTAL_JAC, etiqueta: 'Meta', esMeta: true })

  const filasFibex = hojaComoFilas<FilaTVFibex>(workbook, 'BD_Televentas_Fibex')
  const ultimaFibex = filasEnFechaMasReciente(filasFibex, 'Fecha_Corte', hoy)
  const fibex = ultimaFibex
    ? {
        ventas: sumar(ultimaFibex.filas, 'Total_Ventas'),
        monto: sumar(ultimaFibex.filas, 'Total_Monto_USD'),
        arpu:
          sumar(ultimaFibex.filas, 'Total_Ventas') > 0
            ? Number((sumar(ultimaFibex.filas, 'Total_Monto_USD') / sumar(ultimaFibex.filas, 'Total_Ventas')).toFixed(2))
            : 0,
        hogar: sumar(ultimaFibex.filas, 'Ventas_Hogar'),
        pymes: sumar(ultimaFibex.filas, 'Ventas_Pymes'),
        vendedoresActivos: ultimaFibex.filas.filter((f) => f.Total_Ventas > 0).length,
        top: ultimaFibex.filas
          .slice()
          .sort((a, b) => b.Total_Ventas - a.Total_Ventas)
          .slice(0, 5)
          .map((f) => ({
            nombre: f.Vendedor,
            ventas: f.Total_Ventas,
            monto: f.Total_Monto_USD,
            arpu: f.Total_Ventas > 0 ? Number((f.Total_Monto_USD / f.Total_Ventas).toFixed(2)) : 0,
          })),
        pulso: pulsoPorSemana(filasFibex, 'Semana_Mes', 'Total_Ventas', 'Fecha_Corte'),
      }
    : null

  const filasSeguros = hojaComoFilas<FilaTVSeguros>(workbook, 'BD_Televentas_Seguros')
  const ultimaSeguros = filasEnFechaMasReciente(filasSeguros, 'Fecha_Corte', hoy)
  const seguros = ultimaSeguros
    ? {
        polizas: sumar(ultimaSeguros.filas, 'Ventas_Acum_Mes'),
        ingresos: sumar(ultimaSeguros.filas, 'Ingresos_Acum_Mes_USD'),
        top: ultimaSeguros.filas
          .slice()
          .sort((a, b) => b.Ventas_Acum_Mes - a.Ventas_Acum_Mes)
          .slice(0, 3)
          .map((f) => ({ nombre: f.Asesor, polizas: f.Ventas_Acum_Mes, monto: f.Ingresos_Acum_Mes_USD })),
        pulso: pulsoPorSemana(filasSeguros, 'Semana_Mes', 'Ventas_Acum_Mes', 'Fecha_Corte'),
      }
    : null

  const filasSmartbuy = hojaComoFilas<FilaTVSmartbuy>(workbook, 'BD_Televentas_Smartbuy')
  const ultimaSmartbuy = filasEnFechaMasReciente(filasSmartbuy, 'Fecha_Corte', hoy)
  const smartbuy = ultimaSmartbuy
    ? {
        ventas: sumar(ultimaSmartbuy.filas, 'Ventas_Acum_Mes'),
        articulos: sumar(ultimaSmartbuy.filas, 'Articulos_Acum_Mes'),
        ingresos: sumar(ultimaSmartbuy.filas, 'Ingresos_Acum_Mes_USD'),
        asesores: ultimaSmartbuy.filas
          .slice()
          .sort((a, b) => b.Ventas_Acum_Mes - a.Ventas_Acum_Mes)
          .map((f) => ({ nombre: f.Asesor, ventas: f.Ventas_Acum_Mes, monto: f.Ingresos_Acum_Mes_USD })),
        pulso: pulsoPorSemana(filasSmartbuy, 'Semana_Mes', 'Ventas_Acum_Mes', 'Fecha_Corte'),
      }
    : null

  const fechaResuelta = ultimaFibex?.fecha ?? ultimaSeguros?.fecha ?? ultimaJac?.fecha ?? ultimaSmartbuy?.fecha ?? null

  return {
    fechaCorte: fechaResuelta ? fechaAISO(fechaResuelta) : null,
    jac,
    fibex,
    seguros,
    smartbuy,
  }
}

export { tendencia }
