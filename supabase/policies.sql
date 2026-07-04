-- Fase 1 — Row Level Security
-- Revisar antes de aplicar. Ejecutar después de schema.sql en el SQL Editor de Supabase.

alter table empresas enable row level security;
alter table usuarios enable row level security;
alter table cargas_semanales enable row level security;
alter table metricas enable row level security;

-- empresas: el director ve todas; el gerente solo la suya
create policy "empresas_select" on empresas for select
  using (
    exists (select 1 from usuarios u where u.id = auth.uid() and u.rol in ('director', 'admin'))
    or id = (select empresa_id from usuarios where id = auth.uid())
  );

-- usuarios: cada quien lee únicamente su propia fila
create policy "usuarios_select_propia" on usuarios for select
  using (id = auth.uid());

-- cargas_semanales: el gerente lee/escribe solo lo de su empresa; el director solo lee
create policy "cargas_select" on cargas_semanales for select
  using (
    exists (select 1 from usuarios u where u.id = auth.uid() and u.rol in ('director', 'admin'))
    or empresa_id = (select empresa_id from usuarios where id = auth.uid())
  );

create policy "cargas_insert_gerente" on cargas_semanales for insert
  with check (
    empresa_id = (select empresa_id from usuarios where id = auth.uid())
    and exists (select 1 from usuarios u where u.id = auth.uid() and u.rol = 'gerente')
  );

create policy "cargas_update_gerente" on cargas_semanales for update
  using (
    empresa_id = (select empresa_id from usuarios where id = auth.uid())
    and exists (select 1 from usuarios u where u.id = auth.uid() and u.rol = 'gerente')
  );

-- metricas: hereda el alcance de empresa a través de la carga a la que pertenecen
create policy "metricas_select" on metricas for select
  using (
    exists (
      select 1 from cargas_semanales c
      join usuarios u on u.id = auth.uid()
      where c.id = metricas.carga_id
        and (u.rol in ('director', 'admin') or c.empresa_id = u.empresa_id)
    )
  );

create policy "metricas_insert_gerente" on metricas for insert
  with check (
    exists (
      select 1 from cargas_semanales c
      join usuarios u on u.id = auth.uid()
      where c.id = metricas.carga_id
        and u.rol = 'gerente'
        and c.empresa_id = u.empresa_id
    )
  );

-- Nadie tiene permiso de delete por ahora (ni gerente ni director).
