import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BotonSalir } from '@/components/BotonSalir'
import { SincronizarPanel } from '@/components/SincronizarPanel'
import { TarjetaEmpresa, type Stat } from '@/components/TarjetaEmpresa'
import { calcularDetalleTeleventas, tendencia, META_INDIVIDUAL_JAC, META_TOTAL_JAC } from '@/lib/sync/televentasDetalle'
import styles from './dashboard.module.css'

type Metrica = { nombre_metrica: string; valor: number; meta: number | null; unidad: string | null }
type Carga = { id: string; semana_inicio: string; semana_fin: string; metricas: Metrica[] }
type Empresa = {
  id: string
  nombre: string
  tipo_metrica_principal: string | null
  cargas_semanales: Carga[]
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function nombreMesRelativo(semanaFinISO: string, offset: number): string {
  const [y, m] = semanaFinISO.split('-').map(Number)
  const total = y * 12 + (m - 1) + offset
  return MESES[((total % 12) + 12) % 12]
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatoCorto(fechaISO: string): string {
  const [, m, d] = fechaISO.split('-')
  return `${d}-${MESES_CORTO[Number(m) - 1]}`
}

function formatUsd(v: number): string {
  return `$${v.toLocaleString('es-VE', { maximumFractionDigits: 0 })}`
}
function formatUsd2(v: number): string {
  return v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function formatNum(v: number): string {
  return v.toLocaleString('es-VE', { maximumFractionDigits: 0 })
}
function formatPct1(v: number): string {
  return `${(v * 100).toLocaleString('es-VE', { maximumFractionDigits: 1 })}%`
}

function ultimaCarga(empresas: Empresa[], nombre: string): Carga | undefined {
  return empresas.find((e) => e.nombre === nombre)?.cargas_semanales.slice(-1)[0]
}
function valorDe(carga: Carga | undefined, nombre: string): number | undefined {
  return carga?.metricas.find((m) => m.nombre_metrica === nombre)?.valor
}
function metaDe(carga: Carga | undefined, nombre: string): number | null | undefined {
  return carga?.metricas.find((m) => m.nombre_metrica === nombre)?.meta
}

function pulsoDe(empresas: Empresa[], nombreEmpresa: string, nombreMetrica: string) {
  const empresa = empresas.find((e) => e.nombre === nombreEmpresa)
  if (!empresa) return []
  return empresa.cargas_semanales
    .map((c) => {
      const v = c.metricas.find((m) => m.nombre_metrica === nombreMetrica)?.valor
      return v == null ? null : { valor: v, etiqueta: formatoCorto(c.semana_fin) }
    })
    .filter((x): x is { valor: number; etiqueta: string } => x !== null)
    .slice(-6)
}

function statsTrio(carga: Carga, prefijo: string, formatter: (n: number) => string): Stat[] {
  const mesAnterior = valorDe(carga, `${prefijo}_mes_anterior`)
  const variacion = valorDe(carga, `${prefijo}_variacion_mes`)
  const proyeccion = valorDe(carga, `${prefijo}_proyeccion`)
  const stats: Stat[] = []

  if (mesAnterior != null) {
    stats.push({ lbl: `${capitalizar(nombreMesRelativo(carga.semana_fin, -1))} (cierre)`, val: formatter(mesAnterior) })
  }
  if (variacion != null) {
    stats.push({
      lbl: `Var. vs ${nombreMesRelativo(carga.semana_fin, -1)}`,
      val: `${variacion >= 0 ? '+' : ''}${formatPct1(variacion)}`,
      tono: variacion >= 0 ? 'ok' : 'bad',
    })
  }
  if (proyeccion != null) {
    stats.push({ lbl: `Proy. ${nombreMesRelativo(carga.semana_fin, 1)}*`, val: `≈ ${formatter(proyeccion)}` })
  }
  return stats
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

  const jacCarga = ultimaCarga(empresas, 'AutoClub JAC')
  const fibexCarga = ultimaCarga(empresas, 'Fibex Telecom')
  const smartbuyCarga = ultimaCarga(empresas, 'SmartBuy')
  const segurosCarga = ultimaCarga(empresas, 'La Internacional de Seguros')
  const crealoCarga = ultimaCarga(empresas, 'Crealo')

  const jacVentasVal = valorDe(jacCarga, 'ventas_unidades')
  const jacPostventaVal = valorDe(jacCarga, 'postventa_usd')
  const jacPostventaMeta = metaDe(jacCarga, 'postventa_usd')
  const jacPostventaMostrador = valorDe(jacCarga, 'postventa_mostrador')
  const jacPostventaRptos = valorDe(jacCarga, 'postventa_rptos_servicio')
  const jacPostventaManoObra = valorDe(jacCarga, 'postventa_mano_obra')

  const fibexVentasVal = valorDe(fibexCarga, 'ventas_total')
  const fibexMontoVal = valorDe(fibexCarga, 'monto_total')
  const fibexArpuVal = valorDe(fibexCarga, 'arpu')
  const fibexRitmo = valorDe(fibexCarga, 'ventas_total_ritmo_semanal')
  const fibexProyeccion = valorDe(fibexCarga, 'ventas_total_proyeccion')

  const smartbuyVal = valorDe(smartbuyCarga, 'ventas_usd')
  const smartbuyMeta = metaDe(smartbuyCarga, 'ventas_usd')

  const segurosVal = valorDe(segurosCarga, 'polizas_nuevas')
  const segurosPrimasVal = valorDe(segurosCarga, 'primas_cobradas_usd')
  const segurosPrimasPolizas = valorDe(segurosCarga, 'primas_cobradas_polizas')

  const crealoVal = valorDe(crealoCarga, 'ventas_usd')
  const crealoFacturasValidas = valorDe(crealoCarga, 'facturas_validas')
  const crealoFacturasAnuladas = valorDe(crealoCarga, 'facturas_anuladas')

  const detalleTeleventas = await calcularDetalleTeleventas().catch(() => null)

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <h1>Dashboard Ejecutivo · Comercializa</h1>
        <BotonSalir />
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
            {segurosCarga ? `corte al ${segurosCarga.semana_fin}` : 'sin datos todavía'} · fuente: BD Comercializa
          </div>
        </div>

        {!hayDatos ? (
          <div className={styles.empty}>
            Todavía no hay datos sincronizados. Usa &quot;Sincronizar ahora&quot; arriba para traer la primera semana.
          </div>
        ) : (
          <div className={styles.grid}>
            {jacCarga && jacVentasVal != null && (
              <TarjetaEmpresa
                color="var(--jac)"
                titulo="AutoClub JAC — Ventas (UND totales)"
                big={formatNum(jacVentasVal)}
                bigSmall="unidades · mes en curso"
                kline="Incluye 3 concesionarios + Televentas (Entrega Inmediata + Compra Directa)"
                pulso={pulsoDe(empresas, 'AutoClub JAC', 'ventas_unidades')}
                stats={statsTrio(jacCarga, 'ventas_unidades', formatNum)}
              />
            )}

            {jacCarga && jacPostventaVal != null && (
              <TarjetaEmpresa
                color="var(--post)"
                titulo="AutoClub JAC — Postventa ($)"
                big={formatUsd(jacPostventaVal)}
                bigSmall="cierre de mes"
                metaPillPct={jacPostventaMeta ? jacPostventaVal / jacPostventaMeta : null}
                metaPillTexto={
                  jacPostventaMeta
                    ? `${formatPct1(jacPostventaVal / jacPostventaMeta)} de la meta (${formatUsd(jacPostventaMeta)})`
                    : undefined
                }
                kline={
                  [
                    jacPostventaMostrador != null ? `Mostrador ${formatUsd(jacPostventaMostrador)}` : null,
                    jacPostventaRptos != null ? `Rptos x Servicio ${formatUsd(jacPostventaRptos)}` : null,
                    jacPostventaManoObra != null ? `Mano de Obra ${formatUsd(jacPostventaManoObra)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || undefined
                }
                pulso={pulsoDe(empresas, 'AutoClub JAC', 'postventa_usd')}
              />
            )}

            {fibexCarga && fibexVentasVal != null && (
              <TarjetaEmpresa
                color="var(--fibex)"
                titulo="Televentas Fibex — # / Monto / ARPU"
                big={formatNum(fibexVentasVal)}
                bigSmall={`ventas${fibexMontoVal != null ? ` · ${formatUsd(fibexMontoVal)} suscripción` : ''}${fibexArpuVal != null ? ` · ARPU $${fibexArpuVal}` : ''}`}
                kline="Hogar + Pymes · único canal reportado para Fibex"
                pulso={pulsoDe(empresas, 'Fibex Telecom', 'ventas_total')}
                stats={[
                  ...(fibexRitmo != null ? [{ lbl: 'Ritmo semanal medio', val: `≈ ${formatNum(fibexRitmo)} ventas` }] : []),
                  ...(fibexProyeccion != null
                    ? [{ lbl: `Proy. ${nombreMesRelativo(fibexCarga.semana_fin, 1)}*`, val: `≈ ${formatNum(fibexProyeccion)}` }]
                    : []),
                  { lbl: 'Meta', val: 'no definida', tono: 'faint' as const },
                ]}
              />
            )}

            {smartbuyCarga && smartbuyVal != null && (
              <TarjetaEmpresa
                color="var(--smart)"
                titulo="SmartBuy — Ventas totales ($)"
                big={formatUsd(smartbuyVal)}
                bigSmall="acum. mes en curso"
                metaPillPct={smartbuyMeta ? smartbuyVal / smartbuyMeta : null}
                metaPillTexto={
                  smartbuyMeta
                    ? `${formatPct1(smartbuyVal / smartbuyMeta)} de la meta (${formatUsd(smartbuyMeta)})`
                    : undefined
                }
                pulso={pulsoDe(empresas, 'SmartBuy', 'ventas_usd')}
                stats={statsTrio(smartbuyCarga, 'ventas_usd', formatUsd)}
              />
            )}

            {segurosCarga && segurosVal != null && (
              <TarjetaEmpresa
                color="var(--seg)"
                titulo="La Internacional de Seguros — Pólizas (todos los canales)"
                wide
                big={formatNum(segurosVal)}
                bigSmall="pólizas nuevas · acum. mes"
                pulso={pulsoDe(empresas, 'La Internacional de Seguros', 'polizas_nuevas')}
                stats={statsTrio(segurosCarga, 'polizas_nuevas', formatNum)}
                notaLarga={
                  segurosPrimasVal != null && segurosPrimasPolizas != null
                    ? `Pólizas cobradas en ${nombreMesRelativo(segurosCarga.semana_fin, 0)} (nuevas + renovaciones mensuales): ${formatNum(segurosPrimasPolizas)} → ${formatUsd(segurosPrimasVal)} recaudados. La diferencia entre este total y las ${formatNum(segurosVal)} pólizas nuevas corresponde a renovaciones de pólizas vendidas en meses anteriores.`
                    : undefined
                }
              />
            )}

            {crealoCarga && crealoVal != null && (
              <TarjetaEmpresa
                color="var(--crealo)"
                titulo="Crealo — Ventas totales ($)"
                wide
                big={formatUsd(crealoVal)}
                bigSmall={`cierre de mes${crealoFacturasValidas != null ? ` · ${formatNum(crealoFacturasValidas)} facturas válidas${crealoFacturasAnuladas ? ` (${formatNum(crealoFacturasAnuladas)} anuladas)` : ''}` : ''}`}
                kline="Ingresos por servicios de impresión/instalación y alquileres recurrentes (vallas, publipostes) a otras marcas del holding y clientes externos."
                pulso={pulsoDe(empresas, 'Crealo', 'ventas_usd')}
                stats={statsTrio(crealoCarga, 'ventas_usd', formatUsd)}
              />
            )}
          </div>
        )}

        <div className={styles.footnote}>
          * Proyección: promedio simple de los últimos 3 meses cuando hay histórico mensual completo (2 meses para
          Crealo; Fibex Televentas asume el ritmo semanal del mes en curso). Postventa y unidades JAC reflejan cierre
          de mes; Seguros, SmartBuy y Fibex reflejan el snapshot semanal más reciente. Las tendencias muestran hasta
          las últimas 6 sincronizaciones guardadas.
        </div>
      </div>

      <div className={styles.slide}>
        <div className={styles.slideHead}>
          <h1>Semanal Televentas</h1>
          <div className={styles.sub}>
            canal Televentas por empresa
            {detalleTeleventas?.fechaCorte ? ` · corte al ${detalleTeleventas.fechaCorte}` : ''} · fuente: BD Comercializa
            (en vivo)
          </div>
        </div>

        {!detalleTeleventas ? (
          <div className={styles.empty}>No se pudo leer el detalle de Televentas de la hoja en este momento.</div>
        ) : (
          <>
            <div className={styles.grid}>
              {detalleTeleventas.jac && (
                <TarjetaEmpresa
                  color="var(--jac)"
                  titulo="AutoClub JAC — Televentas 0km (UND + Monto vs Meta)"
                  wide
                  big={formatNum(detalleTeleventas.jac.unidades)}
                  bigSmall={`unidades · ${formatUsd(detalleTeleventas.jac.ingresos)} facturados`}
                  metaPillPct={detalleTeleventas.jac.unidades / META_TOTAL_JAC}
                  metaPillTexto={`${formatPct1(detalleTeleventas.jac.unidades / META_TOTAL_JAC)} de la meta de unidad (${META_TOTAL_JAC} UND)`}
                  kline={`Meta: mínimo 2 ventas por vendedor y ${META_TOTAL_JAC} por la unidad de negocio (${detalleTeleventas.jac.vendedores.length} vendedores)`}
                  pulso={detalleTeleventas.jac.pulso}
                >
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Vendedor</th>
                        <th className={styles.tableNum}>UND acum.</th>
                        <th className={styles.tableNum}>Meta indiv. (2)</th>
                        <th className={styles.tableNum}>Ingresos $</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalleTeleventas.jac.vendedores.map((v) => (
                        <tr key={v.nombre}>
                          <td>{v.nombre}</td>
                          <td className={styles.tableNum}>{v.unidades}</td>
                          <td
                            className={styles.tableNum}
                            style={{
                              fontWeight: 700,
                              color: v.pctMeta >= 1 ? 'var(--ok)' : v.pctMeta > 0 ? 'var(--warn)' : 'var(--bad)',
                            }}
                          >
                            {formatPct1(v.pctMeta)}
                          </td>
                          <td className={styles.tableNum}>{formatUsd2(v.ingresos)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {detalleTeleventas.jac.brecha > 0 && (
                    <div className={styles.stats} style={{ marginTop: '0.6rem' }}>
                      <div>
                        <div className={styles.lbl}>Brecha vs meta</div>
                        <div className={`${styles.val} ${styles.valBad}`}>−{detalleTeleventas.jac.brecha} UND</div>
                      </div>
                    </div>
                  )}
                </TarjetaEmpresa>
              )}

              {detalleTeleventas.fibex && (
                <TarjetaEmpresa
                  color="var(--fibex)"
                  titulo="Televentas Fibex — Detallado"
                  big={formatNum(detalleTeleventas.fibex.ventas)}
                  bigSmall={`ventas · ${formatUsd(detalleTeleventas.fibex.monto)} · ARPU $${detalleTeleventas.fibex.arpu}`}
                  kline={`${detalleTeleventas.fibex.vendedoresActivos} vendedores activos`}
                  pulso={detalleTeleventas.fibex.pulso}
                >
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Top vendedores</th>
                        <th className={styles.tableNum}>Ventas</th>
                        <th className={styles.tableNum}>Monto $</th>
                        <th className={styles.tableNum}>ARPU $</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalleTeleventas.fibex.top.map((v) => (
                        <tr key={v.nombre}>
                          <td>{v.nombre}</td>
                          <td className={styles.tableNum}>{v.ventas}</td>
                          <td className={styles.tableNum}>{formatUsd2(v.monto)}</td>
                          <td className={styles.tableNum}>{formatUsd2(v.arpu)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className={styles.stats}>
                    <div>
                      <div className={styles.lbl}>Hogar</div>
                      <div className={styles.val}>{formatNum(detalleTeleventas.fibex.hogar)} ventas</div>
                    </div>
                    <div>
                      <div className={styles.lbl}>Pymes</div>
                      <div className={styles.val}>{formatNum(detalleTeleventas.fibex.pymes)} ventas</div>
                    </div>
                  </div>
                </TarjetaEmpresa>
              )}

              {detalleTeleventas.seguros && (
                <TarjetaEmpresa
                  color="var(--seg)"
                  titulo="Seguros — Televentas (UND / $)"
                  big={formatNum(detalleTeleventas.seguros.polizas)}
                  bigSmall={`pólizas · ${formatUsd2(detalleTeleventas.seguros.ingresos)}`}
                  pulso={detalleTeleventas.seguros.pulso}
                >
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Top asesores</th>
                        <th className={styles.tableNum}>Pólizas</th>
                        <th className={styles.tableNum}>$</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalleTeleventas.seguros.top.map((v) => (
                        <tr key={v.nombre}>
                          <td>{v.nombre}</td>
                          <td className={styles.tableNum}>{v.polizas}</td>
                          <td className={styles.tableNum}>{formatUsd2(v.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TarjetaEmpresa>
              )}

              {detalleTeleventas.smartbuy && (
                <TarjetaEmpresa
                  color="var(--smart)"
                  titulo="SmartBuy — Televentas (# / $)"
                  wide
                  big={formatNum(detalleTeleventas.smartbuy.ventas)}
                  bigSmall={`ventas · ${formatNum(detalleTeleventas.smartbuy.articulos)} artículos · ${formatUsd2(detalleTeleventas.smartbuy.ingresos)}`}
                  pulso={detalleTeleventas.smartbuy.pulso}
                >
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Asesor</th>
                        <th className={styles.tableNum}>Ventas</th>
                        <th className={styles.tableNum}>$</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalleTeleventas.smartbuy.asesores.map((v) => (
                        <tr key={v.nombre}>
                          <td>{v.nombre}</td>
                          <td className={styles.tableNum}>{v.ventas}</td>
                          <td className={styles.tableNum}>{formatUsd2(v.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TarjetaEmpresa>
              )}

              <TarjetaEmpresa color="var(--ink)" titulo="Lectura ejecutiva del canal" wide>
                <table className={styles.table} style={{ marginTop: 0 }}>
                  <thead>
                    <tr>
                      <th>Unidad</th>
                      <th className={styles.tableNum}>Cierre / corte</th>
                      <th className={styles.tableNum}>Meta</th>
                      <th className={styles.tableNum}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalleTeleventas.jac && (
                      <tr>
                        <td>JAC 0km</td>
                        <td className={styles.tableNum}>{detalleTeleventas.jac.unidades} UND</td>
                        <td className={styles.tableNum}>{META_TOTAL_JAC} UND</td>
                        <td
                          className={styles.tableNum}
                          style={{
                            fontWeight: 700,
                            color:
                              detalleTeleventas.jac.unidades / META_TOTAL_JAC >= 0.9
                                ? 'var(--ok)'
                                : detalleTeleventas.jac.unidades / META_TOTAL_JAC >= 0.6
                                  ? 'var(--warn)'
                                  : 'var(--bad)',
                          }}
                        >
                          {formatPct1(detalleTeleventas.jac.unidades / META_TOTAL_JAC)}
                        </td>
                      </tr>
                    )}
                    {detalleTeleventas.fibex &&
                      (() => {
                        const t = tendencia(detalleTeleventas.fibex.pulso)
                        return (
                          <tr>
                            <td>Fibex</td>
                            <td className={styles.tableNum}>{detalleTeleventas.fibex.ventas} ventas</td>
                            <td className={styles.tableNum}>—</td>
                            <td className={styles.tableNum} style={{ fontWeight: 700, color: `var(--${t.tono})` }}>
                              {t.texto}
                            </td>
                          </tr>
                        )
                      })()}
                    {detalleTeleventas.seguros &&
                      (() => {
                        const t = tendencia(detalleTeleventas.seguros.pulso)
                        return (
                          <tr>
                            <td>Seguros</td>
                            <td className={styles.tableNum}>{detalleTeleventas.seguros.polizas} pólizas</td>
                            <td className={styles.tableNum}>—</td>
                            <td className={styles.tableNum} style={{ fontWeight: 700, color: `var(--${t.tono})` }}>
                              {t.texto}
                            </td>
                          </tr>
                        )
                      })()}
                    {detalleTeleventas.smartbuy &&
                      (() => {
                        const t = tendencia(detalleTeleventas.smartbuy.pulso)
                        return (
                          <tr>
                            <td>SmartBuy</td>
                            <td className={styles.tableNum}>{detalleTeleventas.smartbuy.ventas} ventas</td>
                            <td className={styles.tableNum}>—</td>
                            <td className={styles.tableNum} style={{ fontWeight: 700, color: `var(--${t.tono})` }}>
                              {t.texto}
                            </td>
                          </tr>
                        )
                      })()}
                  </tbody>
                </table>
                {detalleTeleventas.jac && detalleTeleventas.jac.brecha > 0 && (
                  <div className={styles.pending}>
                    Foco: JAC Televentas necesita {detalleTeleventas.jac.brecha} unidades más para alcanzar la meta de{' '}
                    {META_TOTAL_JAC} UND este mes;{' '}
                    {detalleTeleventas.jac.vendedores.filter((v) => v.unidades < META_INDIVIDUAL_JAC).length} de{' '}
                    {detalleTeleventas.jac.vendedores.length} vendedores están por debajo del mínimo individual de{' '}
                    {META_INDIVIDUAL_JAC} ventas.
                  </div>
                )}
              </TarjetaEmpresa>
            </div>

            <div className={styles.footnote}>
              Esta vista se calcula al momento, directo desde la hoja de datos (no queda guardada en el histórico).
              Cortes semanales según el snapshot más reciente de cada fuente.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
