export type Rol = 'gerente' | 'director' | 'admin'

export type Empresa = {
  id: string
  nombre: string
  tipo_metrica_principal: string | null
  activo: boolean
}

export type Usuario = {
  id: string
  email: string
  rol: Rol
  empresa_id: string | null
}

export type CargaSemanal = {
  id: string
  empresa_id: string
  usuario_id: string
  semana_inicio: string
  semana_fin: string
  archivo_original_url: string | null
  fecha_subida: string
}

export type Metrica = {
  id: string
  carga_id: string
  nombre_metrica: string
  valor: number
  meta: number | null
  unidad: string | null
}

export type Database = {
  public: {
    Tables: {
      empresas: {
        Row: Empresa
        Insert: Partial<Empresa> & { nombre: string }
        Update: Partial<Empresa>
        Relationships: []
      }
      usuarios: {
        Row: Usuario
        Insert: Usuario
        Update: Partial<Usuario>
        Relationships: [
          {
            foreignKeyName: 'usuarios_empresa_id_fkey'
            columns: ['empresa_id']
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
        ]
      }
      cargas_semanales: {
        Row: CargaSemanal
        Insert: Partial<CargaSemanal> & {
          empresa_id: string
          usuario_id: string
          semana_inicio: string
          semana_fin: string
        }
        Update: Partial<CargaSemanal>
        Relationships: [
          {
            foreignKeyName: 'cargas_semanales_empresa_id_fkey'
            columns: ['empresa_id']
            referencedRelation: 'empresas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cargas_semanales_usuario_id_fkey'
            columns: ['usuario_id']
            referencedRelation: 'usuarios'
            referencedColumns: ['id']
          },
        ]
      }
      metricas: {
        Row: Metrica
        Insert: Partial<Metrica> & {
          carga_id: string
          nombre_metrica: string
          valor: number
        }
        Update: Partial<Metrica>
        Relationships: [
          {
            foreignKeyName: 'metricas_carga_id_fkey'
            columns: ['carga_id']
            referencedRelation: 'cargas_semanales'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
