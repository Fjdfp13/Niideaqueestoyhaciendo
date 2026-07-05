import { NextResponse } from 'next/server'
import type { WorkBook } from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { descargarWorkbook } from '@/lib/sync/workbook'
import { CALCULADORAS, type ResultadoEmpresa } from '@/lib/sync/compute'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: usuario } = await supabase.from('usuarios').select('*').eq('id', user.id).single()

  if (!usuario || usuario.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo un administrador puede sincronizar' }, { status: 403 })
  }

  let body: { fecha?: string; forzar?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    // sin body: usar valores por defecto
  }

  const objetivo = body.fecha ? new Date(`${body.fecha}T00:00:00Z`) : new Date()
  const forzar = body.forzar === true

  let workbook: WorkBook
  let buffer: ArrayBuffer
  try {
    ;({ workbook, buffer } = await descargarWorkbook())
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error descargando la hoja de datos' },
      { status: 502 }
    )
  }

  const nombreArchivo = `sync-${objetivo.toISOString().slice(0, 10)}-${Date.now()}.xlsx`
  const { error: storageError } = await supabase.storage
    .from('excels-originales')
    .upload(nombreArchivo, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  const archivoUrl = storageError ? null : nombreArchivo

  const resultados: Array<ResultadoEmpresa> = CALCULADORAS.map((calc) => calc(workbook, objetivo))

  const reporte: Array<{
    empresa: string
    estado: 'creada' | 'reemplazada' | 'omitida' | 'sin_datos'
    semana_inicio?: string
    semana_fin?: string
    metricas?: number
  }> = []

  for (let i = 0; i < resultados.length; i++) {
    const resultado = resultados[i]
    if (!resultado) {
      reporte.push({ empresa: '(sin datos para esta fecha)', estado: 'sin_datos' })
      continue
    }

    const { data: empresa } = await supabase
      .from('empresas')
      .select('id')
      .eq('nombre', resultado.empresaNombre)
      .maybeSingle()

    let empresaId = empresa?.id
    if (!empresaId) {
      const { data: nuevaEmpresa, error: empresaError } = await supabase
        .from('empresas')
        .insert({ nombre: resultado.empresaNombre, tipo_metrica_principal: resultado.metricaPrincipal })
        .select('id')
        .single()
      if (empresaError || !nuevaEmpresa) {
        reporte.push({ empresa: resultado.empresaNombre, estado: 'sin_datos' })
        continue
      }
      empresaId = nuevaEmpresa.id
    }

    const { data: cargaExistente } = await supabase
      .from('cargas_semanales')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('semana_inicio', resultado.semana_inicio)
      .maybeSingle()

    if (cargaExistente && !forzar) {
      reporte.push({
        empresa: resultado.empresaNombre,
        estado: 'omitida',
        semana_inicio: resultado.semana_inicio,
        semana_fin: resultado.semana_fin,
      })
      continue
    }

    if (cargaExistente && forzar) {
      await supabase.from('cargas_semanales').delete().eq('id', cargaExistente.id)
    }

    const { data: nuevaCarga, error: cargaError } = await supabase
      .from('cargas_semanales')
      .insert({
        empresa_id: empresaId,
        usuario_id: user.id,
        semana_inicio: resultado.semana_inicio,
        semana_fin: resultado.semana_fin,
        archivo_original_url: archivoUrl,
      })
      .select('id')
      .single()

    if (cargaError || !nuevaCarga) {
      reporte.push({ empresa: resultado.empresaNombre, estado: 'sin_datos' })
      continue
    }

    await supabase.from('metricas').insert(
      resultado.metricas.map((m) => ({
        carga_id: nuevaCarga.id,
        nombre_metrica: m.nombre_metrica,
        valor: m.valor,
        meta: m.meta,
        unidad: m.unidad,
      }))
    )

    reporte.push({
      empresa: resultado.empresaNombre,
      estado: cargaExistente ? 'reemplazada' : 'creada',
      semana_inicio: resultado.semana_inicio,
      semana_fin: resultado.semana_fin,
      metricas: resultado.metricas.length,
    })
  }

  return NextResponse.json({ objetivo: objetivo.toISOString().slice(0, 10), reporte })
}
