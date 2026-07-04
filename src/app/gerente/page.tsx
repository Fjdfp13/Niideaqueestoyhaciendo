import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BotonSalir } from '@/components/BotonSalir'

export default async function GerentePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('*, empresa:empresa_id(nombre)')
    .eq('id', user.id)
    .single()

  if (!usuario) {
    redirect('/sin-acceso')
  }

  if (usuario.rol !== 'gerente') {
    redirect('/director')
  }

  const empresaNombre = (usuario as unknown as { empresa: { nombre: string } | null }).empresa?.nombre

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="label-muted">Vista de gerente</p>
          <h1 style={{ fontSize: '1.4rem' }}>{empresaNombre ?? 'Tu empresa'}</h1>
        </div>
        <BotonSalir />
      </header>

      <div className="card">
        <p>
          Aquí irá la tarjeta con el estado de tu empresa y el botón para subir el Excel semanal
          (Fase 2 del plan).
        </p>
      </div>
    </main>
  )
}
