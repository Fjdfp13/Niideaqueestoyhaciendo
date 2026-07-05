import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BotonSalir } from '@/components/BotonSalir'
import { SincronizarPanel } from '@/components/SincronizarPanel'
import { TarjetaEmpresa } from '@/components/TarjetaEmpresa'
import styles from './dashboard.module.css'

type Metrica = { nombre_metrica: string; valor: number; meta: number | null; unidad: string | null }
type Carga = { id: string; semana_inicio: string; semana_fin: string; metricas: Metrica[] }
type Empresa = {
  id: string
  nombre: string
  tipo_metrica_principal: string | null
  cargas_semanales: Carga[]
}

type Punto = { valor: number; meta: number | null; semanaFin: string }

function serieDe(empresas: Empresa[], nombreEmpresa: string, nombreMetrica: string): Punto[] {
  const empresa = empresas.find((e) => e.nombre === nombreEmpresa)
  if (!empresa) return []
  return empresa.cargas_semanales
    .map((c) => {
      const m = c.metricas.find((mm) => mm.nombre_metrica === nombreMetrica)
      return m ? { valor: m.valor, meta: m.meta, semanaFin: c.semana_fin } : null
    })
    .filter((x): x is Punto => x !== null)
    .slice(-6)
}

function formatoCorto(fechaISO: string): string {
  const [, m, d] = fechaISO.split('-')
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${d}-${meses[Number(m) - 1]}`
}

function formatUsd(v: number): string {
  return `$${v.toLocaleString('es-VE', { maximumFractionDigits: 0 })}`
}

function formatNum(v: number): string {
  return v.toLocaleString('es-VE', { maximumFractionDigits: 0 })
}

function variacion(serie: Punto[]): number | null {
  if (serie.length < 2) return null
  const actual = serie[serie.length - 1].valor
  const anterior = serie[serie.length - 2].valor
  if (anterior === 0) return null
  return (actual - anterior) / anterior
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
    .select(
      'id, nombre, tipo_metrica_principal, cargas_semanales(id, semana_inicio, semana_fin, metricas(nombre_metrica, valor, meta, unidad))'
    )
    .order('nombre')
    .order('semana_inicio', { referencedTable: 'cargas_semanales', ascending: true })

  const empresas = (data ?? []) as unknown as Empresa[]
  const hayDatos = empresas.some((e) => e.cargas_semanales.length > 0)

  const pulso = (serie: Punto[]) => serie.map((p) => ({ valor: p.valor, etiqueta: formatoCorto(p.semanaFin) }))

  // AutoClub JAC — ventas
  const jacVentas = serieDe(empresas, 'AutoClub JAC', 'ventas_unidades')
  const jacVentasActual = jacVentas[jacVentas.length - 1]
  const jacVar = variacion(jacVentas)

  // AutoClub JAC — postventa
  const jacPostventa = serieDe(empresas, 'AutoClub JAC', 'postventa_usd')
  const jacPostventaActual = jacPostventa[jacPostventa.length - 1]
  const jacPostventaPct = jacPostventaActual?.meta ? jacPostventaActual.valor / jacPostventaActual.meta : null

  // Fibex Telecom
  const fibexVentas = serieDe(empresas, 'Fibex Telecom', 'ventas_total')
  const fibexMonto = serieDe(empresas, 'Fibex Telecom', 'monto_total')
  const fibexArpu = serieDe(empresas, 'Fibex Telecom', 'arpu')
  const fibexActual = fibexVentas[fibexVentas.length - 1]
  const fibexMontoActual = fibexMonto[fibexMonto.length - 1]
  const fibexArpuActual = fibexArpu[fibexArpu.length - 1]

  // SmartBuy
  const smartbuy = serieDe(empresas, 'SmartBuy', 'ventas_usd')
  const smartbuyActual = smartbuy[smartbuy.length - 1]
  const smartbuyPct = smartbuyActual?.meta ? smartbuyActual.valor / smartbuyActual.meta : null

  // Seguros
  const segurosPolizas = serieDe(empresas, 'La Internacional de Seguros', 'polizas_nuevas')
  const segurosPrimas = serieDe(empresas, 'La Internacional de Seguros', 'primas_cobradas_usd')
  const segurosActual = segurosPolizas[segurosPolizas.length - 1]
  const segurosPrimasActual = segurosPrimas[segurosPrimas.length - 1]
  const segurosVar = variacion(segurosPolizas)

  // Crealo
  const crealo = serieDe(empresas, 'Crealo', 'ventas_usd')
  const crealoActual = crealo[crealo.length - 1]
  const crealoVar = variacion(crealo)

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <h1>Dashboard Ejecutivo · Comercializa</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <BotonSalir />
        </div>
      </div>

      {usuario.rol === 'admin' && (
        <div style={{ maxWidth: 1760, margin: '0 auto 14px' }}>
          <SincronizarPanel />
        </div>
      )}

      <div className={styles.slide}>
        <div className={styles.slideHead}>
          <h1>Semanal Global</h1>
          <div className={styles.sub}>
            {segurosActual ? `corte al ${segurosActual.semanaFin}` : 'sin datos todavía'} · fuente: BD Comercializa
          </div>
        </div>

        {!hayDatos ? (
          <div className={styles.empty}>
            Todavía no hay datos sincronizados. Usa &quot;Sincronizar ahora&quot; arriba para traer la primera semana.
          </div>
        ) : (
          <div className={styles.grid}>
            {jacVentasActual && (
              <TarjetaEmpresa
                color="var(--jac)"
                titulo="AutoClub JAC — Ventas (UND totales)"
                big={formatNum(jacVentasActual.valor)}
                bigSmall="unidades · mes en curso"
                kline="Incluye 3 concesionarios + Televentas (Entrega Inmediata + Compra Directa)"
                pulso={pulso(jacVentas)}
                stats={
                  jacVar !== null
                    ? [{ lbl: 'Var. vs semana anterior', val: `${jacVar >= 0 ? '+' : ''}${(jacVar * 100).toFixed(1)}%`, tono: jacVar >= 0 ? 'ok' : 'bad' }]
                    : undefined
                }
              />
            )}

            {jacPostventaActual && (
              <TarjetaEmpresa
                color="var(--post)"
                titulo="AutoClub JAC — Postventa ($)"
                big={formatUsd(jacPostventaActual.valor)}
                bigSmall="cierre de mes"
                metaPillPct={jacPostventaPct}
                pulso={pulso(jacPostventa)}
              />
            )}

            {fibexActual && (
              <TarjetaEmpresa
                color="var(--fibex)"
                titulo="Televentas Fibex — # / Monto / ARPU"
                big={formatNum(fibexActual.valor)}
                bigSmall={`ventas · ${fibexMontoActual ? formatUsd(fibexMontoActual.valor) : ''} suscripción · ARPU ${fibexArpuActual ? `$${fibexArpuActual.valor}` : ''}`}
                kline="Hogar + Pymes · único canal reportado para Fibex"
                pulso={pulso(fibexVentas)}
              />
            )}

            {smartbuyActual && (
              <TarjetaEmpresa
                color="var(--smart)"
                titulo="SmartBuy — Ventas totales ($)"
                big={formatUsd(smartbuyActual.valor)}
                bigSmall="acum. mes en curso"
                metaPillPct={smartbuyPct}
                pulso={pulso(smartbuy)}
              />
            )}

            {segurosActual && (
              <TarjetaEmpresa
                color="var(--seg)"
                titulo="La Internacional de Seguros — Pólizas (todos los canales)"
                wide
                big={formatNum(segurosActual.valor)}
                bigSmall="pólizas nuevas · acum. mes"
                pulso={pulso(segurosPolizas)}
                stats={[
                  ...(segurosVar !== null
                    ? [
                        {
                          lbl: 'Var. vs semana anterior',
                          val: `${segurosVar >= 0 ? '+' : ''}${(segurosVar * 100).toFixed(1)}%`,
                          tono: segurosVar >= 0 ? ('ok' as const) : ('bad' as const),
                        },
                      ]
                    : []),
                  ...(segurosPrimasActual
                    ? [{ lbl: 'Primas cobradas (mes)', val: formatUsd(segurosPrimasActual.valor), tono: 'faint' as const }]
                    : []),
                ]}
              />
            )}

            {crealoActual && (
              <TarjetaEmpresa
                color="var(--crealo)"
                titulo="Crealo — Ventas totales ($)"
                wide
                big={formatUsd(crealoActual.valor)}
                bigSmall="cierre de mes"
                kline="Ingresos por servicios de impresión/instalación y alquileres recurrentes a otras marcas del holding y clientes externos."
                pulso={pulso(crealo)}
                stats={
                  crealoVar !== null
                    ? [{ lbl: 'Var. vs semana anterior', val: `${crealoVar >= 0 ? '+' : ''}${(crealoVar * 100).toFixed(1)}%`, tono: crealoVar >= 0 ? 'ok' : 'bad' }]
                    : undefined
                }
              />
            )}
          </div>
        )}

        <div className={styles.footnote}>
          Fibex Telecom, AutoClub JAC (unidades), Seguros y SmartBuy se actualizan cada semana. Postventa y Crealo se
          actualizan cuando cierra el mes. Las tendencias muestran hasta las últimas 6 sincronizaciones guardadas.
        </div>
      </div>
    </div>
  )
}
