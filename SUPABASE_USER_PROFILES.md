# 🔧 Migración: Perfil del Estudiante a Supabase

## ✅ Lo que cambió

La página de inicio ahora **guarda el perfil del estudiante (nombre, CI, carrera, malla, año de ingreso) en Supabase** en lugar de localStorage. Esto permite:

- 📱 **Acceder desde cualquier dispositivo** - Los datos se sincronizan en la nube
- 🔐 **Seguridad** - Cada usuario solo ve/edita su perfil
- ☁️ **Sin dependencia de localStorage** - Funciona mejor en producción

## ⚠️ REQUISITO: Crear tabla en Supabase

**Antes de usar la app, debes crear la tabla `user_profiles` en Supabase:**

### Pasos:

1. **Abre Supabase Dashboard:**
   - Ve a https://supabase.com/dashboard
   - Selecciona tu proyecto SIGA FIUNA

2. **Abre SQL Editor:**
   - En la sidebar izquierda, haz clic en **SQL Editor**

3. **Ejecuta este SQL:**

```sql
-- Tabla para guardar el perfil del estudiante por usuario autenticado
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  alumno TEXT DEFAULT '',
  ci TEXT DEFAULT '',
  ingreso TEXT DEFAULT '',
  malla TEXT DEFAULT '2023',
  carrera TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile"
  ON public.user_profiles FOR DELETE
  USING (auth.uid() = user_id);
```

4. **Haz clic en el botón ▶️ Run**
   - Espera a que termine (verás ✅ "Success")

5. **¡Listo!** Ahora puedes usar la app con la migración completada

## 🧪 Probar localmente

```bash
npm run dev
```

- Abre http://localhost:3000
- Inicia sesión o crea una cuenta
- Completa el perfil (nombre, CI, carrera, etc.)
- Haz clic en **"Cargar Datos"**
- ✅ Los datos ahora se guardan en Supabase

Si abres la app desde otro dispositivo/navegador con la misma cuenta, ¡los datos están ahí! 🎉

## 🚀 Desplegar a Vercel

Después de crear la tabla en Supabase:

```bash
git add .
git commit -m "feat: migrate student profile to Supabase"
git push origin main
```

Luego en Vercel:
1. Tu deployment se disparará automáticamente
2. La app usará la tabla `user_profiles` desde Supabase
3. ✅ Funciona con login desde cualquier dispositivo

## ❓ FAQ

**P: ¿Qué pasa con los datos que guardé en localStorage?**
A: La app intenta leer desde Supabase primero. Si no encuentra nada, carga desde localStorage como fallback.

**P: ¿Se borran los datos viejos?**
A: No. La primera vez que guardes "Cargar Datos", se copia a Supabase. Desde ahí siempre carga desde la nube.

**P: ¿Puedo seguir usando localStorage?**
A: Sí, es el plan B. Pero recomendamos usar Supabase para que funcione en múltiples dispositivos.

