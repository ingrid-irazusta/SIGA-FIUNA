import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yqlodgboglcicrymywww.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxbG9kZ2JvZ2xjaWNyeW15d3d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MDc4OTMsImV4cCI6MjA4NTk4Mzg5M30.XyztN4RVZyPaHmFIKGKnn7OBccQDcbGXy04btQOSRkw';

// Crea una instancia única del cliente Supabase
let supabaseClient = null;

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
};

// Utilidades para trabajar con Supabase

/**
 * Obtiene el perfil del alumno desde Supabase
 * @param {string} ci - Cédula de identidad
 * @returns {Promise<object|null>}
 */
export const getProfile = async (ci) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('ci', ci)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // No existe
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
};

/**
 * Guarda o actualiza el perfil del alumno
 * @param {object} profile - Datos del perfil
 * @returns {Promise<object>}
 */
export const saveProfile = async (profile) => {
  try {
    const supabase = getSupabaseClient();
    const { ci, alumno, ingreso, malla, carrera } = profile;

    // Si hay un usuario autenticado, adjuntar user_id para relacionar
    let userId = null;
    try {
      const { data: authData } = await supabase.auth.getUser();
      userId = authData?.user?.id || null;
    } catch (e) {
      userId = null;
    }

    const payload = { ci, alumno, ingreso, malla, carrera, updated_at: new Date().toISOString() };
    if (userId) payload.user_id = userId;

    // Intenta actualizar, si no existe lo inserta
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        [payload],
        { onConflict: 'ci' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving profile:', error);
    throw error;
  }
};

/**
 * Obtiene el horario del alumno
 * @param {string} ci - Cédula de identidad
 * @returns {Promise<object>}
 */
export const getSchedule = async (ci) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('ci', ci)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return {};
      throw error;
    }
    return data?.schedule_data || {};
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return {};
  }
};

/**
 * Guarda el horario del alumno
 * @param {string} ci - Cédula de identidad
 * @param {object} schedule - Datos del horario
 * @returns {Promise<object>}
 */
export const saveSchedule = async (ci, schedule) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('schedules')
      .upsert(
        [{ ci, schedule_data: schedule, updated_at: new Date().toISOString() }],
        { onConflict: 'ci' }
      )
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving schedule:', error);
    throw error;
  }
};

/**
 * Obtiene las evaluaciones del alumno
 * @param {string} ci - Cédula de identidad
 * @returns {Promise<array>}
 */
export const getEvaluations = async (ci) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('evaluations')
      .select('*')
      .eq('ci', ci);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    return [];
  }
};

/**
 * Guarda evaluaciones del alumno
 * @param {string} ci - Cédula de identidad
 * @param {array} rows - Array de evaluaciones
 * @returns {Promise<array>}
 */
export const saveEvaluations = async (ci, rows) => {
  try {
    const supabase = getSupabaseClient();
    
    // Primero, elimina las evaluaciones existentes para este CI
    await supabase.from('evaluations').delete().eq('ci', ci);
    
    // Luego inserta las nuevas
    if (rows.length > 0) {
      const { data, error } = await supabase
        .from('evaluations')
        .insert(rows.map(row => ({ ...row, ci })))
        .select();
      
      if (error) throw error;
      return data;
    }
    return [];
  } catch (error) {
    console.error('Error saving evaluations:', error);
    throw error;
  }
};

/**
 * Obtiene las notas finales del alumno
 * @param {string} ci - Cédula de identidad
 * @param {string} carrera - Carrera del alumno
 * @param {string} plan - Plan/malla
 * @returns {Promise<array>}
 */
export const getNotas = async (ci, carrera, plan) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('notas_finales')
      .select('*')
      .eq('ci', ci)
      .eq('carrera', carrera)
      .eq('plan', plan);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching notas:', error);
    return [];
  }
};

/**
 * Guarda notas finales del alumno
 * @param {string} ci - Cédula de identidad
 * @param {string} carrera - Carrera del alumno
 * @param {string} plan - Plan/malla
 * @param {array} rows - Array de notas
 * @returns {Promise<array>}
 */
export const saveNotas = async (ci, carrera, plan, rows) => {
  try {
    const supabase = getSupabaseClient();
    
    // Primero, elimina las notas existentes para este CI/carrera/plan
    await supabase
      .from('notas_finales')
      .delete()
      .eq('ci', ci)
      .eq('carrera', carrera)
      .eq('plan', plan);
    
    // Luego inserta las nuevas
    if (rows.length > 0) {
      const { data, error } = await supabase
        .from('notas_finales')
        .insert(rows.map(row => ({ ...row, ci, carrera, plan })))
        .select();
      
      if (error) throw error;
      return data;
    }
    return [];
  } catch (error) {
    console.error('Error saving notas:', error);
    throw error;
  }
};

/**
 * Obtiene la malla curricular en caché
 * @param {string} carrera - Carrera
 * @param {string} plan - Plan/malla
 * @returns {Promise<object|null>}
 */
export const getMallaCache = async (carrera, plan) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('malla_cache')
      .select('*')
      .eq('carrera', carrera)
      .eq('plan', plan)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error fetching malla cache:', error);
    return null;
  }
};

/**
 * Guarda la malla curricular en caché
 * @param {string} carrera - Carrera
 * @param {string} plan - Plan/malla
 * @param {object} mallaData - Datos de la malla
 * @returns {Promise<object>}
 */
export const saveMallaCache = async (carrera, plan, mallaData) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('malla_cache')
      .upsert(
        [{ carrera, plan, items: mallaData.items, updated_at: new Date().toISOString() }],
        { onConflict: 'carrera,plan' }
      )
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving malla cache:', error);
    throw error;
  }
};

/**
 * Obtiene cursos actuales del alumno
 * @param {string} ci - Cédula de identidad
 * @returns {Promise<array>}
 */
export const getCurrentCourses = async (ci) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('current_courses')
      .select('*')
      .eq('ci', ci);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching current courses:', error);
    return [];
  }
};

/**
 * Guarda cursos actuales del alumno
 * @param {string} ci - Cédula de identidad
 * @param {array} courses - Array de cursos
 * @returns {Promise<array>}
 */
export const saveCurrentCourses = async (ci, courses) => {
  try {
    const supabase = getSupabaseClient();
    
    // Elimina los cursos existentes
    await supabase.from('current_courses').delete().eq('ci', ci);
    
    // Inserta los nuevos
    if (courses.length > 0) {
      const { data, error } = await supabase
        .from('current_courses')
        .insert(courses.map(course => ({ ...course, ci })))
        .select();
      
      if (error) throw error;
      return data;
    }
    return [];
  } catch (error) {
    console.error('Error saving current courses:', error);
    throw error;
  }
};
/**
 * Obtiene el perfil del usuario autenticado actual
 * @returns {Promise<object|null>}
 */
export const getProfileForAuthUser = async () => {
  try {
    const supabase = getSupabaseClient();
    
    // Obtener usuario actual de la sesión
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('No authenticated user');
      return null;
    }

    // Buscar perfil asociado al user_id
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // No existe aún
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching auth user profile:', error);
    return null;
  }
};

/**
 * Guarda o actualiza el perfil del usuario autenticado
 * @param {object} profileData - { alumno, ci, ingreso, malla, carrera }
 * @returns {Promise<object>}
 */
export const saveProfileForAuthUser = async (profileData) => {
  try {
    const supabase = getSupabaseClient();
    
    // Obtener usuario actual de la sesión
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('No authenticated user');
    }

    const { alumno, ci, ingreso, malla, carrera } = profileData;
    
    // Upsert: inserta o actualiza según el user_id
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(
        [{
          user_id: user.id,
          alumno: alumno || '',
          ci: ci || '',
          ingreso: ingreso || '',
          malla: malla || '2023',
          carrera: carrera || '',
          updated_at: new Date().toISOString()
        }],
        { onConflict: 'user_id' }
      )
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving auth user profile:', error);
    throw error;
  }
};