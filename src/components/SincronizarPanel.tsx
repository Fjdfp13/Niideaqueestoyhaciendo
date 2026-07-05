'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ItemReporte = {
  empresa: string
  estado: 'creada' | 'reemplazada' | 'omitida' | 'sin_datos'
  semana_inicio?: string
  semana_fin?: string
  metricas?: number
}

const ETIQUETAS: Record<ItemReporte['estado'], string> = {
  creada: 'Creada',
  reemplazada: 'Reemplazada',
  omitida: 'Ya existía (sin cambios)',
  sin_datos: 'Sin datos para esta fecha',
}

export function SincronizarPanel() {
  const router = useRouter()
  const [fecha, setFecha] = useState('')
  const [forzar, setForzar] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reporte, setReporte] = useState<ItemReporte[] | null>(null)

  async function sincronizar() {
    setPending(true)
    setError(null)
    setReporte(null)

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: fecha || undefined, forzar }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al sincronizar')
        return
      }

      setReporte(data.reporte)
      router.refresh()
    } catch {
      setError('No se pudo conectar con el servidor')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1rem' }}>Sincronizar datos</h2>
          <p className="label-muted">Trae los últimos números desde la hoja de cálculo</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <input
            type="date"
            className="input"
            style={{ width: 'auto' }}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={forzar} onChange={(e) => setForzar(e.target.checked)} />
            Reemplazar si ya existe
          </label>
          <button className="button" disabled={pending} onClick={sincronizar}>
            {pending ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {reporte && (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', paddingLeft: '1.1rem' }}>
          {reporte.map((item, i) => (
            <li key={i}>
              <strong>{item.empresa}</strong> — {ETIQUETAS[item.estado]}
              {item.semana_fin ? ` · semana al ${item.semana_fin}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
