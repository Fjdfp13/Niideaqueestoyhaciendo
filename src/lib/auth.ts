import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Usuario } from '@/types/database'

export async function getUsuarioActual(): Promise<Usuario | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', user.id)
    .single()

  return usuario
}
