/**
 * Adaptador de almacenamiento que proporciona una interfaz uniforme
 * entre localStorage (para compatibilidad) y Supabase
 */

import {
  getProfile,
  saveProfile,
  getSchedule,
  saveSchedule,
  getEvaluations,
  saveEvaluations,
  getNotas,
  saveNotas,
  getMallaCache,
  saveMallaCache,
  getCurrentCourses,
  saveCurrentCourses,
} from './supabase';

/**
 * Máquina de estado para el almacenamiento
 * 'supabase': almacenamiento principal en la base de datos Supabase.
 * Todos los datos (perfiles, horarios, evaluaciones, notas, malla, cursos) van a Supabase.
 */
let SYNC_MODE = 'supabase'; // 'supabase' | 'hybrid' | 'localstorage'

export const setSyncMode = (mode) => {
  SYNC_MODE = mode;
};

/**
 * Perfil del alumno
 */
export const loadProfileAsync = async (ci) => {
  try {
    if (SYNC_MODE === 'supabase' || SYNC_MODE === 'hybrid') {
      const data = await getProfile(ci);
      return data || null;
    }
    // Fallback a localStorage
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('fiuna_os_profile_v1') : null;
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('Error loading profile:', error);
    return null;
  }
};

export const saveProfileAsync = async (profile) => {
  try {
    if (SYNC_MODE === 'supabase' || SYNC_MODE === 'hybrid') {
      const saved = await saveProfile(profile);
      // En modo hybrid, también guardar en localStorage
      if (SYNC_MODE === 'hybrid' && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('fiuna_os_profile_v1', JSON.stringify(profile));
        } catch {}
      }
      return saved;
    }
    // Fallback a localStorage
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('fiuna_os_profile_v1', JSON.stringify(profile));
    }
    return profile;
  } catch (error) {
    console.error('Error saving profile:', error);
    throw error;
  }
};

/**
 * Horario
 */
export const loadScheduleAsync = async (ci) => {
  try {
    if (SYNC_MODE === 'supabase' || SYNC_MODE === 'hybrid') {
      const data = await getSchedule(ci);
      return data || {};
    }
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('fiuna_os_schedule_v1') : null;
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error('Error loading schedule:', error);
    return {};
  }
};

export const saveScheduleAsync = async (ci, schedule) => {
  try {
    if (SYNC_MODE === 'supabase' || SYNC_MODE === 'hybrid') {
      const saved = await saveSchedule(ci, schedule);
      if (SYNC_MODE === 'hybrid' && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('fiuna_os_schedule_v1', JSON.stringify(schedule));
        } catch {}
      }
      return saved;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('fiuna_os_schedule_v1', JSON.stringify(schedule));
    }
    return schedule;
  } catch (error) {
    console.error('Error saving schedule:', error);
    throw error;
  }
};

/**
 * Evaluaciones
 */
export const loadEvaluationsAsync = async (ci) => {
  try {
    if (SYNC_MODE === 'supabase' || SYNC_MODE === 'hybrid') {
      const data = await getEvaluations(ci);
      return Array.isArray(data) ? data : [];
    }
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('fiuna_os_evaluaciones_v1') : null;
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error loading evaluations:', error);
    return [];
  }
};

export const saveEvaluationsAsync = async (ci, evaluations) => {
  try {
    if (SYNC_MODE === 'supabase' || SYNC_MODE === 'hybrid') {
      const saved = await saveEvaluations(ci, evaluations);
      if (SYNC_MODE === 'hybrid' && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('fiuna_os_evaluaciones_v1', JSON.stringify(evaluations));
        } catch {}
      }
      return saved;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('fiuna_os_evaluaciones_v1', JSON.stringify(evaluations));
    }
    return evaluations;
  } catch (error) {
    console.error('Error saving evaluations:', error);
    throw error;
  }
};

/**
 * Notas finales
 */
export const loadNotasAsync = async (ci, carrera, plan) => {
  try {
    if (SYNC_MODE === 'supabase' || SYNC_MODE === 'hybrid') {
      const data = await getNotas(ci, carrera, plan);
      return Array.isArray(data) ? data : [];
    }
    const key = `fiuna_os_notas_finales_v3:${carrera}:${plan}:${ci}`;
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error loading notas:', error);
    return [];
  }
};

export const saveNotasAsync = async (ci, carrera, plan, notas) => {
  try {
    if (SYNC_MODE === 'supabase' || SYNC_MODE === 'hybrid') {
      const saved = await saveNotas(ci, carrera, plan, notas);
      if (SYNC_MODE === 'hybrid' && typeof window !== 'undefined') {
        try {
          const key = `fiuna_os_notas_finales_v3:${carrera}:${plan}:${ci}`;
          window.localStorage.setItem(key, JSON.stringify(notas));
        } catch {}
      }
      return saved;
    }
    if (typeof window !== 'undefined') {
      const key = `fiuna_os_notas_finales_v3:${carrera}:${plan}:${ci}`;
      window.localStorage.setItem(key, JSON.stringify(notas));
    }
    return notas;
  } catch (error) {
    console.error('Error saving notas:', error);
    throw error;
  }
};

/**
 * Caché de malla
 */
export const loadMallaCacheAsync = async (carrera, plan) => {
  try {
    if (SYNC_MODE === 'supabase' || SYNC_MODE === 'hybrid') {
      const data = await getMallaCache(carrera, plan);
      return data || null;
    }
    const key = `fiuna_os_malla_cache_v1:${carrera}:${plan}`;
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('Error loading malla cache:', error);
    return null;
  }
};

export const saveMallaCacheAsync = async (carrera, plan, mallaData) => {
  try {
    if (SYNC_MODE === 'supabase' || SYNC_MODE === 'hybrid') {
      const saved = await saveMallaCache(carrera, plan, mallaData);
      if (SYNC_MODE === 'hybrid' && typeof window !== 'undefined') {
        try {
          const key = `fiuna_os_malla_cache_v1:${carrera}:${plan}`;
          window.localStorage.setItem(key, JSON.stringify(mallaData));
        } catch {}
      }
      return saved;
    }
    if (typeof window !== 'undefined') {
      const key = `fiuna_os_malla_cache_v1:${carrera}:${plan}`;
      window.localStorage.setItem(key, JSON.stringify(mallaData));
    }
    return mallaData;
  } catch (error) {
    console.error('Error saving malla cache:', error);
    throw error;
  }
};

/**
 * Cursos actuales
 */
export const loadCurrentCoursesAsync = async (ci) => {
  try {
    if (SYNC_MODE === 'supabase' || SYNC_MODE === 'hybrid') {
      const data = await getCurrentCourses(ci);
      return Array.isArray(data) ? data : [];
    }
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('fiuna_os_current_courses_v1') : null;
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error loading current courses:', error);
    return [];
  }
};

export const saveCurrentCoursesAsync = async (ci, courses) => {
  try {
    if (SYNC_MODE === 'supabase' || SYNC_MODE === 'hybrid') {
      const saved = await saveCurrentCourses(ci, courses);
      if (SYNC_MODE === 'hybrid' && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('fiuna_os_current_courses_v1', JSON.stringify(courses));
        } catch {}
      }
      return saved;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('fiuna_os_current_courses_v1', JSON.stringify(courses));
    }
    return courses;
  } catch (error) {
    console.error('Error saving current courses:', error);
    throw error;
  }
};
