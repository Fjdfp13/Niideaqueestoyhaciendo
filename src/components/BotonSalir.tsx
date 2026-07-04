'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function BotonSalir() {
  const router = useRouter()

  async function handleClick() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button onClick={handleClick} className="button-secondary">
      Salir
    </button>
  )
}
