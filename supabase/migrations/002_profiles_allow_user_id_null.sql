-- Permite que la columna user_id en la tabla profiles acepte NULL
-- Ejecutar en la consola SQL de Supabase o aplicar como migración

ALTER TABLE public.profiles
  ALTER COLUMN user_id DROP NOT NULL;

-- (Opcional) Si la columna no existe, descomenta y ejecuta la siguiente línea en su lugar:
-- ALTER TABLE public.profiles ADD COLUMN user_id UUID;
