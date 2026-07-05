export function formatValor(valor: number, unidad: string | null): string {
  if (unidad === 'USD') {
    return `$${valor.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }
  return valor.toLocaleString('es-VE', { maximumFractionDigits: 2 })
}

export function formatPct(pct: number): string {
  return `${(pct * 100).toLocaleString('es-VE', { maximumFractionDigits: 1 })}%`
}
