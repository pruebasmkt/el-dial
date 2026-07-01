# Guía de Deployment — El Dial

## Paso 1: Instalar Node.js

Descarga e instala Node.js desde https://nodejs.org (versión 18 o superior).

Verifica con:
```bash
node --version
npm --version
```

## Paso 2: Instalar dependencias del proyecto

```bash
cd ~/el-dial
npm install
```

## Paso 3: Crear proyecto en Supabase

1. Ve a https://supabase.com y crea una cuenta
2. Crea un nuevo proyecto (nombre: "el-dial", elige región más cercana)
3. Espera que inicialice (~2 min)
4. Ve a **Settings → API** y copia:
   - `Project URL`
   - `anon public key`
   - `service_role key` (guardarlo seguro)

## Paso 4: Ejecutar migraciones SQL

1. En Supabase, ve a **SQL Editor**
2. Copia y pega el contenido de `supabase/migrations/001_initial.sql`
3. Ejecuta (botón Run)
4. Verifica que se crearon todas las tablas en **Table Editor**

## Paso 5: Crear usuario administrador

En Supabase → **Authentication → Users → Add user**:
- Email: tu-email@ejemplo.com
- Password: contraseña segura
- Marcar "Auto Confirm"

## Paso 6: Configurar variables de entorno locales

```bash
cp .env.local.example .env.local
```

Edita `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

## Paso 7: Probar en local

```bash
npm run dev
```

Abre http://localhost:3000 e ingresa con tus credenciales.

## Paso 8: Subir a GitHub

```bash
cd ~/el-dial
git init
git add .
git commit -m "feat: El Dial v1.0 - Sistema de gestión con FIFO"
```

1. Crea un repositorio en https://github.com/new (nombre: "el-dial", privado)
2. Sigue las instrucciones de GitHub para conectar el repo remoto:
```bash
git remote add origin https://github.com/TU-USUARIO/el-dial.git
git branch -M main
git push -u origin main
```

## Paso 9: Deployment en Vercel

1. Ve a https://vercel.com e inicia sesión con GitHub
2. Clic en **"New Project"**
3. Importa el repositorio `el-dial`
4. En **"Environment Variables"** agrega:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Clic en **"Deploy"**

Vercel detecta automáticamente que es un proyecto Next.js.

## Paso 10: Configurar dominio (opcional)

En Vercel → tu proyecto → **Settings → Domains** puedes agregar tu dominio personalizado.

---

## Arquitectura para escalar (>1000 productos, >100 ventas/día)

- **Supabase** maneja perfectamente hasta ~10,000 productos y ~500 ventas/día en el plan gratuito
- Para mayor escala: plan Pro de Supabase incluye más conexiones y storage
- El FIFO está implementado en PostgreSQL con `FOR UPDATE` para evitar race conditions
- Las vistas materializadas (`v_inventory_status`, `v_sales_summary`) se pueden convertir a MATERIALIZED VIEW con refresh periódico si la carga crece
- **Paginación**: las tablas grandes se pueden paginar en Supabase con `.range(from, to)` en las queries

## Números de orden/venta

Los números actuales usan `Date.now()` como fallback. Para producción, ejecutar en SQL:
```sql
-- Esto ya está en la migración, pero verificar que las funciones existen:
SELECT next_po_number();
SELECT next_sale_number();
```

Y actualizar `purchases-client.tsx` y `api/sales/route.ts` para llamar estas funciones RPC.
