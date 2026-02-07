import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient, saveProfileForAuthUser } from './supabase';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Obtener sesión actual
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        setUser(data?.session?.user || null);
      } catch (err) {
        console.error('Auth check error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Escuchar cambios en autenticación
    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  // Login con email y contraseña
  const login = useCallback(async (email, password) => {
    try {
      setError(null);
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      setUser(data?.user || null);
      
      // Guardar perfil básico del usuario autenticado
      if (data?.user?.id) {
        try {
          await saveProfileForAuthUser({
            alumno: '',
            ci: '',
            ingreso: '',
            malla: '2023',
            carrera: '',
          });
        } catch (profileErr) {
          console.warn('Could not save user profile on login:', profileErr);
        }
      }
      
      return { success: true, user: data?.user };
    } catch (err) {
      const message = err.message || 'Error al iniciar sesión';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  // Registrarse
  const signup = useCallback(async (email, password) => {
    try {
      setError(null);
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      
      // Guardar perfil básico del usuario registrado
      if (data?.user?.id) {
        try {
          await saveProfileForAuthUser({
            alumno: '',
            ci: '',
            ingreso: '',
            malla: '2023',
            carrera: '',
          });
        } catch (profileErr) {
          console.warn('Could not save user profile on signup:', profileErr);
        }
      }
      
      return { success: true, user: data?.user };
    } catch (err) {
      const message = err.message || 'Error al registrarse';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      setError(null);
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) throw error;
      setUser(null);
      return { success: true };
    } catch (err) {
      const message = err.message || 'Error al cerrar sesión';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  return {
    user,
    loading,
    error,
    login,
    signup,
    logout,
    isAuthenticated: !!user,
  };
};
