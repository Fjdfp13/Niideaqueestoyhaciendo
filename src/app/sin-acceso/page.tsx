import { BotonSalir } from '@/components/BotonSalir'

export default function SinAccesoPage() {
  return (
    <main
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div className="card" style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.2rem' }}>Tu cuenta aún no tiene acceso asignado</h1>
        <p className="label-muted">
          Tu usuario existe pero todavía no tiene un rol ni una empresa asociada. Pide al
          administrador que complete tu alta en la tabla <code>usuarios</code>.
        </p>
        <BotonSalir />
      </div>
    </main>
  )
}
