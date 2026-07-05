export function TendenciaMini({ valores, color }: { valores: number[]; color: string }) {
  if (valores.length === 0) return null
  const max = Math.max(...valores, 1)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 40, marginTop: '0.6rem' }}>
      {valores.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.max((v / max) * 100, 4)}%`,
            background: color,
            opacity: i === valores.length - 1 ? 1 : 0.45,
            borderRadius: '2px 2px 0 0',
          }}
          title={String(v)}
        />
      ))}
    </div>
  )
}
