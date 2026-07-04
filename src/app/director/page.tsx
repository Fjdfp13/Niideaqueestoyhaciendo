import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BotonSalir } from '@/components/BotonSalir'

export default async function DirectorPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!usuario) {
    redirect('/sin-acceso')
  }

  if (usuario.rol !== 'director' && usuario.rol !== 'admin') {
    redirect('/gerente')
  }

  const { data: empresas } = await supabase.from('empresas').select('*').order('nombre')

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="label-muted">Torre de control</p>
          <h1 style={{ fontSize: '1.4rem' }}>Dashboard consolidado</h1>
        </div>
        <BotonSalir />
      </header>

      <div className="card">
        <p style={{ marginBottom: '0.75rem' }}>
          Empresas activas en el holding ({empresas?.length ?? 0}). El dashboard con semáforo,
          cumplimiento de meta y tendencia de 6 semanas se construye en la Fase 3.
        </p>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '1.1rem' }}>
          {empresas?.map((empresa) => (
            <li key={empresa.id}>{empresa.nombre}</li>
          ))}
        </ul>
      </div>
    </main>
  )
}
