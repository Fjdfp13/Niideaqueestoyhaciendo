import type { ReactNode } from 'react'
import styles from '@/app/director/dashboard.module.css'
import { PulseChart, type PuntoPulso } from './PulseChart'

export type Stat = { lbl: string; val: string; tono?: 'ok' | 'warn' | 'bad' | 'faint' }

const TONO_CLASE: Record<NonNullable<Stat['tono']>, string> = {
  ok: styles.valOk,
  warn: styles.valWarn,
  bad: styles.valBad,
  faint: styles.valFaint,
}

export function TarjetaEmpresa({
  color,
  titulo,
  wide,
  big,
  bigSmall,
  kline,
  metaPillPct,
  metaPillTexto,
  stats,
  pulso,
  notaLarga,
  children,
}: {
  color: string
  titulo: string
  wide?: boolean
  big?: string
  bigSmall?: string
  kline?: string
  metaPillPct?: number | null
  metaPillTexto?: string
  stats?: Stat[]
  pulso?: PuntoPulso[]
  notaLarga?: string
  children?: ReactNode
}) {
  const metaTono = metaPillPct == null ? null : metaPillPct >= 0.9 ? 'ok' : metaPillPct >= 0.6 ? 'warn' : 'bad'
  const metaClase =
    metaTono === 'ok' ? styles.metaPillOk : metaTono === 'warn' ? styles.metaPillWarn : styles.metaPillBad

  return (
    <div className={`${styles.card} ${wide ? styles.cardWide : ''}`}>
      <h3>
        <span className={styles.dot} style={{ background: color }} />
        {titulo}
      </h3>
      {big && (
        <div className={styles.big}>
          {big} {bigSmall && <small>{bigSmall}</small>}
          {metaPillPct != null && (
            <span className={`${styles.metaPill} ${metaClase}`}>
              {metaPillTexto ?? `${(metaPillPct * 100).toLocaleString('es-VE', { maximumFractionDigits: 1 })}% de la meta`}
            </span>
          )}
        </div>
      )}
      {kline && <div className={styles.kline}>{kline}</div>}
      {pulso && pulso.length > 0 && <PulseChart puntos={pulso} color={color} />}
      {stats && stats.length > 0 && (
        <div className={styles.stats}>
          {stats.map((s, i) => (
            <div key={i}>
              <div className={styles.lbl}>{s.lbl}</div>
              <div className={`${styles.val} ${s.tono ? TONO_CLASE[s.tono] : ''}`}>{s.val}</div>
            </div>
          ))}
        </div>
      )}
      {notaLarga && (
        <div className={styles.kline} style={{ marginTop: '0.6rem' }}>
          {notaLarga}
        </div>
      )}
      {children}
    </div>
  )
}
