-- Fase 2 — permisos adicionales para el rol admin (sincronización de datos)
-- Ejecutar después de policies.sql en el SQL Editor de Supabase.

-- admin puede insertar/actualizar/borrar cargas de cualquier empresa (sincronización)
create policy "cargas_insert_admin" on cargas_semanales for insert
  with check (
    exists (select 1 from usuarios u where u.id = auth.uid() and u.rol = 'admin')
  );

create policy "cargas_update_admin" on cargas_semanales for update
  using (
    exists (select 1 from usuarios u where u.id = auth.uid() and u.rol = 'admin')
  );

create policy "cargas_delete_admin" on cargas_semanales for delete
  using (
    exists (select 1 from usuarios u where u.id = auth.uid() and u.rol = 'admin')
  );

-- admin puede insertar/borrar métricas de cualquier carga
create policy "metricas_insert_admin" on metricas for insert
  with check (
    exists (select 1 from usuarios u where u.id = auth.uid() and u.rol = 'admin')
  );

create policy "metricas_delete_admin" on metricas for delete
  using (
    exists (select 1 from usuarios u where u.id = auth.uid() and u.rol = 'admin')
  );

-- admin puede insertar/editar empresas (para dar de alta nuevas unidades de negocio)
create policy "empresas_insert_admin" on empresas for insert
  with check (
    exists (select 1 from usuarios u where u.id = auth.uid() and u.rol = 'admin')
  );

create policy "empresas_update_admin" on empresas for update
  using (
    exists (select 1 from usuarios u where u.id = auth.uid() and u.rol = 'admin')
  );

-- Storage: bucket privado para los Excel/snapshots originales de cada sincronización
insert into storage.buckets (id, name, public)
values ('excels-originales', 'excels-originales', false)
on conflict (id) do nothing;

create policy "excels_admin_insert" on storage.objects for insert
  with check (
    bucket_id = 'excels-originales'
    and exists (select 1 from usuarios u where u.id = auth.uid() and u.rol = 'admin')
  );

create policy "excels_admin_select" on storage.objects for select
  using (
    bucket_id = 'excels-originales'
    and exists (select 1 from usuarios u where u.id = auth.uid() and u.rol in ('admin', 'director'))
  );
