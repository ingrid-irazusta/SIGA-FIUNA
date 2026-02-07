'use client';

import { useState, useEffect, useCallback } from 'react';
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
 * Hook para manejar el perfil del alumno
 * @param {string} ci - Cédula de identidad
 * @returns {object}
 */
export const useProfile = (ci) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ci) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        setLoading(true);
        const data = await getProfile(ci);
        setProfile(data || null);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [ci]);

  const updateProfile = useCallback(
    async (newData) => {
      try {
        const updated = await saveProfile({ ...profile, ...newData });
        setProfile(updated);
        return updated;
      } catch (err) {
        setError(err);
        throw err;
      }
    },
    [profile]
  );

  return { profile, loading, error, updateProfile };
};

/**
 * Hook para manejar el horario del alumno
 * @param {string} ci - Cédula de identidad
 * @returns {object}
 */
export const useSchedule = (ci) => {
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ci) {
      setSchedule({});
      setLoading(false);
      return;
    }

    const loadSchedule = async () => {
      try {
        setLoading(true);
        const data = await getSchedule(ci);
        setSchedule(data || {});
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading schedule:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSchedule();
  }, [ci]);

  const updateSchedule = useCallback(
    async (newSchedule) => {
      try {
        await saveSchedule(ci, newSchedule);
        setSchedule(newSchedule);
        return newSchedule;
      } catch (err) {
        setError(err);
        throw err;
      }
    },
    [ci]
  );

  return { schedule, loading, error, updateSchedule };
};

/**
 * Hook para manejar evaluaciones
 * @param {string} ci - Cédula de identidad
 * @returns {object}
 */
export const useEvaluations = (ci) => {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ci) {
      setEvaluations([]);
      setLoading(false);
      return;
    }

    const loadEvaluations = async () => {
      try {
        setLoading(true);
        const data = await getEvaluations(ci);
        setEvaluations(data);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading evaluations:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEvaluations();
  }, [ci]);

  const updateEvaluations = useCallback(
    async (newRows) => {
      try {
        const saved = await saveEvaluations(ci, newRows);
        setEvaluations(newRows);
        return saved;
      } catch (err) {
        setError(err);
        throw err;
      }
    },
    [ci]
  );

  return { evaluations, loading, error, updateEvaluations };
};

/**
 * Hook para manejar notas finales
 * @param {string} ci - Cédula de identidad
 * @param {string} carrera - Carrera del alumno
 * @param {string} plan - Plan/malla
 * @returns {object}
 */
export const useNotas = (ci, carrera, plan) => {
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ci || !carrera || !plan) {
      setNotas([]);
      setLoading(false);
      return;
    }

    const loadNotas = async () => {
      try {
        setLoading(true);
        const data = await getNotas(ci, carrera, plan);
        setNotas(data);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading notas:', err);
      } finally {
        setLoading(false);
      }
    };

    loadNotas();
  }, [ci, carrera, plan]);

  const updateNotas = useCallback(
    async (newRows) => {
      try {
        const saved = await saveNotas(ci, carrera, plan, newRows);
        setNotas(newRows);
        return saved;
      } catch (err) {
        setError(err);
        throw err;
      }
    },
    [ci, carrera, plan]
  );

  return { notas, loading, error, updateNotas };
};

/**
 * Hook para manejar caché de malla curricular
 * @param {string} carrera - Carrera
 * @param {string} plan - Plan/malla
 * @returns {object}
 */
export const useMallaCache = (carrera, plan) => {
  const [malla, setMalla] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!carrera || !plan) {
      setMalla(null);
      setLoading(false);
      return;
    }

    const loadMalla = async () => {
      try {
        setLoading(true);
        const data = await getMallaCache(carrera, plan);
        setMalla(data);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading malla cache:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMalla();
  }, [carrera, plan]);

  const updateMallaCache = useCallback(
    async (mallaData) => {
      try {
        const saved = await saveMallaCache(carrera, plan, mallaData);
        setMalla(saved);
        return saved;
      } catch (err) {
        setError(err);
        throw err;
      }
    },
    [carrera, plan]
  );

  return { malla, loading, error, updateMallaCache };
};

/**
 * Hook para manejar cursos actuales
 * @param {string} ci - Cédula de identidad
 * @returns {object}
 */
export const useCurrentCourses = (ci) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ci) {
      setCourses([]);
      setLoading(false);
      return;
    }

    const loadCourses = async () => {
      try {
        setLoading(true);
        const data = await getCurrentCourses(ci);
        setCourses(data);
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Error loading current courses:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, [ci]);

  const updateCourses = useCallback(
    async (newCourses) => {
      try {
        const saved = await saveCurrentCourses(ci, newCourses);
        setCourses(newCourses);
        return saved;
      } catch (err) {
        setError(err);
        throw err;
      }
    },
    [ci]
  );

  return { courses, loading, error, updateCourses };
};
