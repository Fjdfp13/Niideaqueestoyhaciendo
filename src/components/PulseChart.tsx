export type PuntoPulso = { valor: number; etiqueta: string; esMeta?: boolean }

function formatCorto(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString('es-VE', { maximumFractionDigits: 1 })}k`
  return v.toLocaleString('es-VE', { maximumFractionDigits: 1 })
}

export function PulseChart({ puntos, color }: { puntos: PuntoPulso[]; color: string }) {
  if (puntos.length === 0) return null
  const max = Math.max(...puntos.map((p) => p.valor), 1)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 74, marginTop: 12, color }}>
      {puntos.map((p, i) => (
        <div
          key={i}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%' }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, marginBottom: 3, color: 'var(--ink)' }}>{formatCorto(p.valor)}</span>
          <div
            style={{
              width: '100%',
              borderRadius: '4px 4px 0 0',
              minHeight: 3,
              height: `${Math.max((p.valor / max) * 100, 3)}%`,
              background: p.esMeta ? 'transparent' : color,
              opacity: p.esMeta ? 0.35 : 1,
              border: p.esMeta ? `1px dashed ${color}` : 'none',
            }}
          />
          <span style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 4 }}>{p.etiqueta}</span>
        </div>
      ))}
    </div>
  )
}
