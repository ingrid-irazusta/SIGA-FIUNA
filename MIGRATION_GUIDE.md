# Guía de Migración a Supabase - SIGA FIUNA

## Estado Actual

He preparado tu proyecto para que funcione con Supabase. Aquí está lo que se ha hecho:

### ✅ Completado

1. **Instalación de Supabase** - Cliente `@supabase/supabase-js` instalado
2. **Configuración Supabase** - Archivo `lib/supabase.js` con todas las funciones de conexión
3. **Storage Adapter** - Archivo `lib/storage-adapter.js` que proporciona una capa de abstracción
4. **Hooks Personalizados** - Archivo `lib/hooks.js` con hooks para cada tipo de dato
5. **Documentación de Tablas** - `SUPABASE_SETUP.md` con el SQL necesario

### 📋 Pasos Pendientes

#### 1. Crear las Tablas en Supabase

1. Ve a https://app.supabase.com/
2. Selecciona tu proyecto SIGA FIUNA
3. Ve a **SQL Editor** → **New Query**
4. Copia y ejecuta CADA bloque SQL de `SUPABASE_SETUP.md`
5. Verifica que todas las tablas estén creadas en **Tables**

#### 2. Completar la Migración en tu Código

El proyecto ya tiene integración con Supabase a través de un **adaptador de almacenamiento** que permite:
- Usar localStorage como fallback si Supabase no está disponible
- Sincronizar datos entre localStorage y Supabase en modo "hybrid"
- Cambiar completamente a Supabase en modo "supabase"

### 🔧 Cómo Usar el Storage Adapter

El `storage-adapter.js` reemplaza todas las llamadas a `localStorage` con funciones que pueden operar con Supabase:

```javascript
// Antes (localStorage)
const raw = localStorage.getItem('fiuna_os_profile_v1');
const profile = JSON.parse(raw);

// Ahora (con Supabase)
import { loadProfileAsync } from "../lib/storage-adapter";

const profile = await loadProfileAsync(ci);
```

### 🔄 Cambios Necesarios en tus Componentes

Para migrar cada página/componente:

1. **Agregar imports:**
```javascript
import { 
  loadProfileAsync, saveProfileAsync,
  loadScheduleAsync, saveScheduleAsync,
  // ... etc
} from "../lib/storage-adapter";
```

2. **Reemplazar llamadas a localStorage:**
```javascript
// Anterior
const raw = localStorage.getItem(SCHEDULE_KEY);
const schedule = JSON.parse(raw || '{}');

// Nuevo
const schedule = await loadScheduleAsync(profileCI);
```

3. **Guardar datos (ahora es async):**
```javascript
// Anterior
localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));

// Nuevo
await saveScheduleAsync(profileCI, schedule);
```

### 📄 Componentes y Atajos Pendientes de Migración

1. **app/page.jsx** - Página de inicio
   - [x] Imports actualizados
   - [ ] Funciones loadProfile/saveProfile → async
   - [ ] Función syncMallaAndNotas → async

2. **app/horario/page.jsx** - Horario de clases
   - [x] Imports actualizados
   - [ ] loadSchedule/saveSchedule → async
   - [ ] useEffect para cargar perfil

3. **app/evaluaciones/page.jsx** - Exámenes
   - [ ] Migración completa a Supabase

4. **app/notas-finales/page.jsx** - Notas
   - [ ] Migración completa a Supabase

5. **components/AppShell.jsx** - Header
   - [ ] Cargar perfil desde Supabase

### 🎯 Próximos Pasos Recomendados

1. **Crear las tablas en Supabase** (ver SUPABASE_SETUP.md)
2. **Probar la conexión** con una página simple
3. **Migrar componentes uno por uno** empezando por los más pequeños
4. **Usar modo "hybrid"** inicialmente para tener respaldo en localStorage
5. **Cambiar a "supabase" completo** una vez verificado que funciona

### 🔐 Modos de sincronización

En `lib/storage-adapter.js` puedes cambiar el modo:

```javascript
// En lib/storage-adapter.js
let SYNC_MODE = 'supabase';  // Opciones: 'supabase' | 'hybrid' | 'localstorage'

// Puedes cambiar dinámicamente si es necesario:
export const setSyncMode = (mode) => {
  SYNC_MODE = mode;
};
```

- **`'supabase'`**: Usa solo Supabase (no localStorage)
- **`'hybrid'`**: Usa Supabase Y sincroniza con localStorage
- **`'localstorage'`**: Solo localStorage (fallback)

### 💡 Ejemplo: Migrar la Página de Horario

```javascript
// 1. Agregar imports
import { loadScheduleAsync, saveScheduleAsync, loadProfileAsync } from "../../lib/storage-adapter";

// 2. En el componente
const [schedule, setSchedule] = useState({});
const [profileCI, setProfileCI] = useState("");

// 3. Cargar datos al montar
useEffect(() => {
  const loadData = async () => {
    try {
      // Obtener el CI del perfil actual
      const profile = await loadProfileAsync("");
      if (profile?.ci) {
        setProfileCI(profile.ci);
        // Cargar el horario
        const stored = await loadScheduleAsync(profile.ci);
        setSchedule(stored || {});
      }
    } catch (error) {
      console.error("Error loading schedule:", error);
    }
  };
  loadData();
}, []);

// 4. Guardar cambios
const onSaveSchedule = async (newSchedule) => {
  try {
    await saveScheduleAsync(profileCI, newSchedule);
    setSchedule(newSchedule);
  } catch (error) {
    alert("Error al guardar");
  }
};
```

### 🚀 Testing

Una vez tengas las tablas creadas en Supabase, puedes probar:

```bash
# En tu terminal
npm run dev

# Ve a http://localhost:3000
# Intenta:
# 1. Guardar un perfil (CI, nombre, carrera, malla)
# 2. Cargar un horario
# 3. Ejecutar "Cargar Datos" para sincronizar malla/notas
```

Verifica en tu dashboard de Supabase que los datos se estén guardando en las tablas.

### 📝 Notas Importantes

- **Todos los datos ahora necesitan un CI** como identificador único
- **Las operaciones de guardado son async** - necesitan `await`
- **El storage adapter proporciona fallback a localStorage** automáticamente
- **La migración es gradual** - puedes ir componente por componente

### ✋ Si Necesitas Ayuda

1. Verifica que las tablas estén creadas en Supabase
2. Comprueba la consola del navegador para errores
3. Mira los logs de Supabase en el dashboard
4. Usa el modo `'hybrid'` inicialmente para debug

---

**¡La estructura está lista! Ahora solo necesitas crear las tablas en Supabase y gradualmente migrar cada componente.**
