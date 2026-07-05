import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BotonSalir } from '@/components/BotonSalir'
import { SincronizarPanel } from '@/components/SincronizarPanel'
import { TendenciaMini } from '@/components/TendenciaMini'
import { formatPct, formatValor } from '@/lib/format'

type Metrica = { nombre_metrica: string; valor: number; meta: number | null; unidad: string | null }
type Carga = { id: string; semana_inicio: string; semana_fin: string; metricas: Metrica[] }
type Empresa = {
  id: string
  nombre: string
  tipo_metrica_principal: string | null
  cargas_semanales: Carga[]
}

function semaforo(cumplimientoPct: number | null, variacion: number | null): { color: string; label: string } {
  if (cumplimientoPct !== null) {
    if (cumplimientoPct >= 0.9) return { color: 'var(--verde)', label: 'En meta' }
    if (cumplimientoPct >= 0.6) return { color: 'var(--ambar)', label: 'Atención' }
    return { color: 'var(--rojo)', label: 'Riesgo' }
  }
  if (variacion !== null) {
    if (variacion > 0.02) return { color: 'var(--verde)', label: 'Creciendo' }
    if (variacion < -0.02) return { color: 'var(--rojo)', label: 'Cayendo' }
  }
  return { color: 'var(--muted)', label: 'Sin meta' }
}

export default async function DirectorPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: usuario } = await supabase.from('usuarios').select('*').eq('id', user.id).single()

  if (!usuario) {
    redirect('/sin-acceso')
  }

  if (usuario.rol !== 'director' && usuario.rol !== 'admin') {
    redirect('/gerente')
  }

  const { data } = await supabase
    .from('empresas')
    .select('id, nombre, tipo_metrica_principal, cargas_semanales(id, semana_inicio, semana_fin, metricas(nombre_metrica, valor, meta, unidad))')
    .order('nombre')
    .order('semana_inicio', { referencedTable: 'cargas_semanales', ascending: true })

  const empresas = (data ?? []) as unknown as Empresa[]

  let empresasEnMeta = 0
  let empresasEnRiesgo = 0
  let empresasConMeta = 0

  const filas = empresas.map((empresa) => {
    const cargas = empresa.cargas_semanales ?? []
    const ultimas6 = cargas.slice(-6)
    const ultima = ultimas6[ultimas6.length - 1]
    const anterior = ultimas6[ultimas6.length - 2]

    const principal = empresa.tipo_metrica_principal
    const metricaActual = ultima?.metricas.find((m) => m.nombre_metrica === principal) ?? null
    const metricaAnterior = anterior?.metricas.find((m) => m.nombre_metrica === principal) ?? null

    const cumplimientoPct =
      metricaActual?.meta && metricaActual.meta > 0 ? metricaActual.valor / metricaActual.meta : null

    const variacion =
      metricaActual && metricaAnterior && metricaAnterior.valor > 0
        ? (metricaActual.valor - metricaAnterior.valor) / metricaAnterior.valor
        : null

    const { color, label } = semaforo(cumplimientoPct, variacion)

    if (cumplimientoPct !== null) {
      empresasConMeta++
      if (cumplimientoPct >= 0.9) empresasEnMeta++
    }
    if (color === 'var(--rojo)') empresasEnRiesgo++

    const tendencia = ultimas6
      .map((c) => c.metricas.find((m) => m.nombre_metrica === principal)?.valor)
      .filter((v): v is number => typeof v === 'number')

    return {
      id: empresa.id,
      nombre: empresa.nombre,
      metricaActual,
      cumplimientoPct,
      variacion,
      color,
      label,
      tendencia,
      semanaFin: ultima?.semana_fin ?? null,
    }
  })

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="label-muted">Torre de control</p>
          <h1 style={{ fontSize: '1.4rem' }}>Dashboard consolidado</h1>
        </div>
        <BotonSalir />
      </header>

      <div className="grid-resumen" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="card">
          <p className="label-muted">Empresas activas</p>
          <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>{empresas.length}</p>
        </div>
        <div className="card">
          <p className="label-muted">En meta (de las que tienen meta definida)</p>
          <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>
            {empresasEnMeta}/{empresasConMeta}
          </p>
        </div>
        <div className="card">
          <p className="label-muted">En riesgo</p>
          <p style={{ fontSize: '1.8rem', fontWeight: 700, color: empresasEnRiesgo > 0 ? 'var(--rojo)' : 'var(--verde)' }}>
            {empresasEnRiesgo}
          </p>
        </div>
      </div>

      {usuario.rol === 'admin' && <SincronizarPanel />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filas.length === 0 && (
          <div className="card">
            <p className="label-muted">Todavía no hay datos sincronizados.</p>
          </div>
        )}

        {filas.map((fila) => (
          <div key={fila.id} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: fila.color, display: 'inline-block' }} />
                <h3 style={{ fontSize: '1rem' }}>{fila.nombre}</h3>
                <span className="label-muted" style={{ fontSize: '0.75rem' }}>{fila.label}</span>
              </div>

              {fila.metricaActual ? (
                <>
                  <p style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '0.3rem' }}>
                    {formatValor(fila.metricaActual.valor, fila.metricaActual.unidad)}{' '}
                    <span className="label-muted" style={{ fontSize: '0.85rem', fontWeight: 400 }}>
                      {fila.metricaActual.unidad === 'USD' ? '' : fila.metricaActual.unidad}
                    </span>
                  </p>
                  <p className="label-muted" style={{ fontSize: '0.8rem' }}>
                    {fila.metricaActual.meta
                      ? `Meta: ${formatValor(fila.metricaActual.meta, fila.metricaActual.unidad)} · ${
                          fila.cumplimientoPct !== null ? formatPct(fila.cumplimientoPct) : '—'
                        } cumplido`
                      : 'Meta no definida'}
                    {fila.variacion !== null && (
                      <>
                        {' · '}
                        <span style={{ color: fila.variacion >= 0 ? 'var(--verde)' : 'var(--rojo)' }}>
                          {fila.variacion >= 0 ? '+' : ''}
                          {formatPct(fila.variacion)} vs. semana anterior
                        </span>
                      </>
                    )}
                    {fila.semanaFin ? ` · corte ${fila.semanaFin}` : ''}
                  </p>
                </>
              ) : (
                <p className="label-muted" style={{ marginTop: '0.3rem' }}>Sin datos aún</p>
              )}
            </div>

            <TendenciaMini valores={fila.tendencia} color={fila.color} />
          </div>
        ))}
      </div>
    </main>
  )
}
