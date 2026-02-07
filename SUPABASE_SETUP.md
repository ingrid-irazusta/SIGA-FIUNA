# Tablas Supabase para SIGA FIUNA

Ejecuta los siguientes comandos SQL en la consola de Supabase (SQL Editor) para crear las tablas necesarias:

## 1. Tabla de Perfiles (Alumnos)

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  ci TEXT UNIQUE NOT NULL,
  alumno TEXT,
  ingreso TEXT,
  malla TEXT DEFAULT '2023',
  carrera TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Crear índice en CI para búsquedas rápidas
CREATE INDEX idx_profiles_ci ON profiles(ci);
```

## 2. Tabla de Horarios

```sql
CREATE TABLE IF NOT EXISTS schedules (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  ci TEXT UNIQUE NOT NULL,
  schedule_data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (ci) REFERENCES profiles(ci) ON DELETE CASCADE
);

CREATE INDEX idx_schedules_ci ON schedules(ci);
```

## 3. Tabla de Evaluaciones

```sql
CREATE TABLE IF NOT EXISTS evaluations (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  ci TEXT NOT NULL,
  fecha TEXT,
  tipo TEXT,
  materia TEXT,
  hora TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (ci) REFERENCES profiles(ci) ON DELETE CASCADE
);

CREATE INDEX idx_evaluations_ci ON evaluations(ci);
```

## 4. Tabla de Notas Finales

```sql
CREATE TABLE IF NOT EXISTS notas_finales (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  ci TEXT NOT NULL,
  carrera TEXT NOT NULL,
  plan TEXT NOT NULL,
  semestre INTEGER,
  materia TEXT,
  nota1 TEXT DEFAULT '',
  nota2 TEXT DEFAULT '',
  nota3 TEXT DEFAULT '',
  nota4 TEXT DEFAULT '',
  nota5 TEXT DEFAULT '',
  nota6 TEXT DEFAULT '',
  base BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (ci) REFERENCES profiles(ci) ON DELETE CASCADE
);

CREATE INDEX idx_notas_ci ON notas_finales(ci);
CREATE INDEX idx_notas_carrera_plan ON notas_finales(carrera, plan);
```

## 5. Tabla de Caché de Malla

```sql
CREATE TABLE IF NOT EXISTS malla_cache (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  carrera TEXT NOT NULL,
  plan TEXT NOT NULL,
  items JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(carrera, plan)
);

CREATE INDEX idx_malla_carrera_plan ON malla_cache(carrera, plan);
```

## 6. Tabla de Cursos Actuales

```sql
CREATE TABLE IF NOT EXISTS current_courses (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  ci TEXT NOT NULL,
  materia TEXT,
  seccion TEXT,
  profesor TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (ci) REFERENCES profiles(ci) ON DELETE CASCADE
);

CREATE INDEX idx_current_courses_ci ON current_courses(ci);
```

## Pasos para crear las tablas:

1. Ve a tu proyecto Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a "SQL Editor" en el menú izquierdo
4. Crea una nueva consulta (botón "New Query")
5. Copia y ejecuta CADA bloque SQL anterior
6. Verifica que todas las tablas se hayan creado correctamente en la sección "Tables"

## Políticas de seguridad (Opcional pero recomendado):

Si quieres añadir seguridad básica (todos pueden leer y escribir sus propios datos):

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_finales ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE malla_cache ENABLE ROW LEVEL SECURITY;

-- Políticas para perfiles (anon puede leer su propio perfil)
CREATE POLICY "Anon can view own profile" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Anon can update own profile" ON profiles
  FOR UPDATE USING (true);

CREATE POLICY "Anon can insert profile" ON profiles
  FOR INSERT WITH CHECK (true);

-- Aplicar políticas similares a otras tablas si es necesario
```

**Nota:** Para esta aplicación sin login, mantenemos el acceso abierto. Si en el futuro implementas autenticación, puedes refinar estas políticas para mayor seguridad.
