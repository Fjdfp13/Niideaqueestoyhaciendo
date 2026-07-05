import 'server-only'
import type * as XLSX from 'xlsx'
import { fechaAISO, filasEnFechaMasReciente, hojaComoFilas, restarDias, serialAFecha, sumar } from './workbook'

export type MetricaCalculada = {
  nombre_metrica: string
  valor: number
  meta: number | null
  unidad: string | null
}

export type ResultadoEmpresa = {
  empresaNombre: string
  metricaPrincipal: string
  semana_inicio: string
  semana_fin: string
  metricas: MetricaCalculada[]
} | null

type FilaVentasJAC = {
  Fecha_Corte: number
  Unidades_Acum_Mes: number
}

type FilaPostventa = {
  Fecha_Corte: number
  Mes_Num: number
  Año: number
  Tipo_Registro: string
  USD_Periodo: number | null
  Meta_Mensual: number | null
}

type FilaSegurosMensual = {
  Fecha_Corte: number
  Polizas_Acum_Mes: number
}

type FilaPrimasCobradas = {
  Fecha_Corte: number
  Monto_USD_Acum_Mes: number
}

type FilaSmartbuy = {
  Fecha_Corte: number
  USD_Acum_Mes: number
  Meta_Mensual: number | null
}

type FilaCrealo = {
  Año: number
  Fecha_Emision: number
  Total_Ventas_Netas_USD: number | null
  Estado: string
}

type FilaFibex = {
  Fecha_Corte: number
  Total_Ventas: number
  Total_Monto_USD: number
}

function semanaDesde(fecha: Date) {
  return { semana_inicio: fechaAISO(restarDias(fecha, 6)), semana_fin: fechaAISO(fecha) }
}

/**
 * Fuentes como Postventa (solo cierres mensuales) o Crealo (facturas sueltas) no tienen su
 * propio snapshot semanal. Para saber a qué mes de reporte corresponde la sincronización,
 * se usa como referencia BD_Ventas_JAC, que sí se actualiza cada semana sin falta.
 */
function resolverMesReferencia(wb: XLSX.WorkBook, objetivo: Date): Date {
  const filas = hojaComoFilas<FilaVentasJAC>(wb, 'BD_Ventas_JAC')
  const encontrado = filasEnFechaMasReciente(filas, 'Fecha_Corte', objetivo)
  return encontrado?.fecha ?? objetivo
}

export function calcularFibexTelecom(wb: XLSX.WorkBook, objetivo: Date): ResultadoEmpresa {
  const filas = hojaComoFilas<FilaFibex>(wb, 'BD_Televentas_Fibex')
  const encontrado = filasEnFechaMasReciente(filas, 'Fecha_Corte', objetivo)
  if (!encontrado) return null

  const ventas = sumar(encontrado.filas, 'Total_Ventas')
  const monto = sumar(encontrado.filas, 'Total_Monto_USD')

  return {
    empresaNombre: 'Fibex Telecom',
    metricaPrincipal: 'ventas_total',
    ...semanaDesde(encontrado.fecha),
    metricas: [
      { nombre_metrica: 'ventas_total', valor: ventas, meta: null, unidad: 'ventas' },
      { nombre_metrica: 'monto_total', valor: monto, meta: null, unidad: 'USD' },
      {
        nombre_metrica: 'arpu',
        valor: ventas > 0 ? Number((monto / ventas).toFixed(2)) : 0,
        meta: null,
        unidad: 'USD',
      },
    ],
  }
}

export function calcularAutoClubJAC(wb: XLSX.WorkBook, objetivo: Date): ResultadoEmpresa {
  const filasVentas = hojaComoFilas<FilaVentasJAC>(wb, 'BD_Ventas_JAC')
  const encontradoVentas = filasEnFechaMasReciente(filasVentas, 'Fecha_Corte', objetivo)
  if (!encontradoVentas) return null

  const unidades = sumar(encontradoVentas.filas, 'Unidades_Acum_Mes')

  const metricas: MetricaCalculada[] = [
    { nombre_metrica: 'ventas_unidades', valor: unidades, meta: null, unidad: 'unidades' },
  ]

  // Postventa solo tiene cierres mensuales (sin snapshots semanales); se agrega si el mes de
  // la semana que se está sincronizando (no necesariamente "hoy") ya cerró.
  const mesReferencia = resolverMesReferencia(wb, objetivo)
  const filasPostventa = hojaComoFilas<FilaPostventa>(wb, 'BD_Postventa')
  const cierreDelMes = filasPostventa.filter(
    (f) =>
      f.Tipo_Registro === 'Cierre Mensual' &&
      f.Año === mesReferencia.getUTCFullYear() &&
      f.Mes_Num === mesReferencia.getUTCMonth() + 1
  )
  if (cierreDelMes.length > 0) {
    const totalUsd = sumar(cierreDelMes, 'USD_Periodo')
    const totalMeta = cierreDelMes.reduce((acc, f) => acc + (f.Meta_Mensual ?? 0), 0)
    metricas.push({
      nombre_metrica: 'postventa_usd',
      valor: Number(totalUsd.toFixed(2)),
      meta: totalMeta > 0 ? totalMeta : null,
      unidad: 'USD',
    })
  }

  return {
    empresaNombre: 'AutoClub JAC',
    metricaPrincipal: 'ventas_unidades',
    ...semanaDesde(encontradoVentas.fecha),
    metricas,
  }
}

export function calcularSeguros(wb: XLSX.WorkBook, objetivo: Date): ResultadoEmpresa {
  const filasMensual = hojaComoFilas<FilaSegurosMensual>(wb, 'BD_Ventas_Seguros_Mensual')
  const encontradoMensual = filasEnFechaMasReciente(filasMensual, 'Fecha_Corte', objetivo)
  if (!encontradoMensual) return null

  const polizas = sumar(encontradoMensual.filas, 'Polizas_Acum_Mes')
  const metricas: MetricaCalculada[] = [
    { nombre_metrica: 'polizas_nuevas', valor: polizas, meta: null, unidad: 'pólizas' },
  ]

  const filasPrimas = hojaComoFilas<FilaPrimasCobradas>(wb, 'BD_Primas_Cobradas_Seguros')
  const encontradoPrimas = filasEnFechaMasReciente(filasPrimas, 'Fecha_Corte', objetivo)
  if (encontradoPrimas) {
    metricas.push({
      nombre_metrica: 'primas_cobradas_usd',
      valor: sumar(encontradoPrimas.filas, 'Monto_USD_Acum_Mes'),
      meta: null,
      unidad: 'USD',
    })
  }

  return {
    empresaNombre: 'La Internacional de Seguros',
    metricaPrincipal: 'polizas_nuevas',
    ...semanaDesde(encontradoMensual.fecha),
    metricas,
  }
}

export function calcularSmartBuy(wb: XLSX.WorkBook, objetivo: Date): ResultadoEmpresa {
  const filas = hojaComoFilas<FilaSmartbuy>(wb, 'BD_Ventas_Smartbuy')
  const encontrado = filasEnFechaMasReciente(filas, 'Fecha_Corte', objetivo)
  if (!encontrado) return null

  const valor = sumar(encontrado.filas, 'USD_Acum_Mes')
  const meta = encontrado.filas[0]?.Meta_Mensual ?? null

  return {
    empresaNombre: 'SmartBuy',
    metricaPrincipal: 'ventas_usd',
    ...semanaDesde(encontrado.fecha),
    metricas: [{ nombre_metrica: 'ventas_usd', valor, meta, unidad: 'USD' }],
  }
}

export function calcularCrealo(wb: XLSX.WorkBook, objetivo: Date): ResultadoEmpresa {
  // Crealo no tiene snapshots semanales propios (son facturas sueltas): se usa el mismo mes
  // de referencia que el resto de las empresas para que la sincronización quede pareja.
  const mesReferencia = resolverMesReferencia(wb, objetivo)
  const inicioMes = new Date(Date.UTC(mesReferencia.getUTCFullYear(), mesReferencia.getUTCMonth(), 1))
  const finMes = new Date(Date.UTC(mesReferencia.getUTCFullYear(), mesReferencia.getUTCMonth() + 1, 0))

  const filas = hojaComoFilas<FilaCrealo>(wb, 'BD_Ventas_Crealo')
  const filasDelMes = filas.filter((f) => {
    if (f.Estado === 'Anulada' || typeof f.Fecha_Emision !== 'number' || f.Total_Ventas_Netas_USD == null) {
      return false
    }
    const fecha = serialAFecha(f.Fecha_Emision)
    return fecha.getTime() >= inicioMes.getTime() && fecha.getTime() <= finMes.getTime()
  })

  if (filasDelMes.length === 0) return null

  const total = sumar(filasDelMes, 'Total_Ventas_Netas_USD')

  return {
    empresaNombre: 'Crealo',
    metricaPrincipal: 'ventas_usd',
    ...semanaDesde(mesReferencia),
    metricas: [{ nombre_metrica: 'ventas_usd', valor: Number(total.toFixed(2)), meta: null, unidad: 'USD' }],
  }
}

export const CALCULADORAS = [
  calcularFibexTelecom,
  calcularAutoClubJAC,
  calcularSeguros,
  calcularSmartBuy,
  calcularCrealo,
]
