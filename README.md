# Dashboard Corporación

Dashboard ejecutivo para un holding con varias empresas: cada gerente sube su Excel
semanal, el director comercial ve un panel único y consolidado. Ver el plan completo de
fases en el prompt de arranque del proyecto.

**Estado actual: Fase 1** — proyecto base, esquema de datos, RLS y login con roles
(gerente / director). La carga de Excel y el dashboard visual llegan en las próximas fases.

## Stack

- Next.js 16 (App Router) + TypeScript, `npm`, Node 20.9+
- Supabase (Postgres + Auth), vía `@supabase/ssr`

## Cómo correrlo en local

### 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com), crea una cuenta si no tienes una, y crea un
   nuevo proyecto (capa gratuita).
2. En **Project Settings → API** copia:
   - `Project URL`
   - `anon public` key
3. En **SQL Editor**, pega y ejecuta el contenido de `supabase/schema.sql` (crea las 4
   tablas). Después pega y ejecuta `supabase/policies.sql` (activa Row Level Security).
   Revisa las políticas antes de correrlas — están comentadas para que sepas qué hace cada
   una.

### 2. Crear usuarios de prueba

Los usuarios no se auto-registran: los da de alta el administrador. Por ahora, hazlo a mano
desde Supabase Studio:

1. **Authentication → Users → Add user** — crea un usuario con email y password (por
   ejemplo `gerente@fibex.test` y `director@corp.test`).
2. En **Table Editor → empresas**, inserta al menos una empresa (ej. "Fibex Telecom").
3. En **Table Editor → usuarios**, inserta una fila por cada usuario creado en el paso 1,
   usando el mismo `id` (uuid) que le asignó Supabase Auth:
   - Gerente: `rol = 'gerente'`, `empresa_id` = el id de la empresa del paso 2.
   - Director: `rol = 'director'`, `empresa_id` = null.

### 3. Configurar variables de entorno

Copia `.env.example` a `.env.local` y completa con los valores del paso 1:

```bash
cp .env.example .env.local
```

### 4. Instalar y correr

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Sin sesión, redirige a `/login`.
Inicia sesión con el gerente o el director de prueba: cada uno debe caer en `/gerente` o
`/director` respectivamente. Si un usuario de Auth no tiene fila en `usuarios`, verá
`/sin-acceso`.

## Desplegar

- **Frontend**: importa el repo en [Vercel](https://vercel.com/new) y agrega las mismas
  variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) en
  **Project Settings → Environment Variables**.
- **Backend**: el proyecto de Supabase ya está en la nube desde que lo creaste; no requiere
  despliegue aparte.

## Estructura del proyecto

```
src/
  app/
    login/          Login (email/password)
    gerente/         Vista del gerente (placeholder, se completa en Fase 2)
    director/        Vista consolidada del director (placeholder, se completa en Fase 3)
    sin-acceso/      Pantalla para usuarios de Auth sin fila en `usuarios`
    page.tsx         Redirige según el rol del usuario autenticado
  components/
    BotonSalir.tsx   Cierre de sesión
  lib/
    auth.ts          Helper para obtener el usuario + rol actual
    supabase/        Clientes de Supabase (browser, server, proxy)
  proxy.ts           Antes "middleware": refresca la sesión y protege rutas
  types/database.ts  Tipos TS del esquema
supabase/
  schema.sql         Tablas
  policies.sql       Políticas de Row Level Security
```
