'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './login.module.css';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginPage() {
  const router = useRouter();
  const { login, signup, error: authError, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setLocalSuccess('');

    // Validaciones
    if (!email || !isValidEmail(email)) {
      setLocalError('Por favor ingresa un email válido');
      return;
    }

    if (isForgotPassword) {
      setLocalSuccess('Si la cuenta existe, recibirás un enlace de recuperación en tu email');
      return;
    }

    if (!password) {
      setLocalError('Por favor ingresa una contraseña');
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setLocalError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setLocalError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsLoading(true);

    try {
      let result;
      if (isSignUp) {
        result = await signup(email, password);
        if (result.success) {
          setLocalSuccess('¡Cuenta creada! Por favor confirma tu email');
          setTimeout(() => {
            setIsSignUp(false);
            setPassword('');
            setConfirmPassword('');
            setLocalSuccess('');
          }, 3000);
        } else {
          setLocalError(result.error || 'Error al crear la cuenta');
        }
      } else {
        result = await login(email, password);
        if (result.success) {
          router.push('/');
        } else {
          setLocalError(result.error || 'Email o contraseña incorrectos');
          setPassword('');
        }
      }
    } catch (err) {
      setLocalError(err.message || 'Error inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.background}>
        <div className={styles.backgroundShape1}></div>
        <div className={styles.backgroundShape2}></div>
        <div className={styles.backgroundShape3}></div>
      </div>

      <div className={styles.content}>
        <div className={styles.card}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.logo}>
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="40" height="40" rx="8" fill="#0066cc" />
                <path
                  d="M12 20L18 26L28 14"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className={styles.title}>S.I.G.A. FIUNA</h1>
            <p className={styles.subtitle}>
              {isForgotPassword ? 'Recuperar contraseña' : isSignUp ? 'Crea tu cuenta' : 'Inicia sesión'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Success Message */}
            {localSuccess && (
              <div className={styles.successMessage}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" />
                  <path d="M7 10L9 12L13 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{localSuccess}</span>
              </div>
            )}

            {/* Error Message */}
            {(localError || authError) && (
              <div className={styles.errorMessage}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" />
                  <path d="M10 6V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="10" cy="14" r="0.5" fill="currentColor" />
                </svg>
                <span>{localError || authError}</span>
              </div>
            )}

            {/* Email Input */}
            <div className={styles.inputGroup}>
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            {/* Password Input */}
            {!isForgotPassword && (
              <div className={styles.inputGroup}>
                <label htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            )}

            {/* Confirm Password (Sign Up) */}
            {isSignUp && !isForgotPassword && (
              <div className={styles.inputGroup}>
                <label htmlFor="confirmPassword">Confirmar contraseña</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            )}

            {/* Forgot Password Link */}
            {!isSignUp && !isForgotPassword && (
              <button
                type="button"
                className={styles.forgotLink}
                onClick={() => setIsForgotPassword(true)}
                disabled={isLoading}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading || loading}
            >
              {isLoading || loading ? (
                <span className={styles.spinner}></span>
              ) : isForgotPassword ? (
                'Enviar enlace de recuperación'
              ) : isSignUp ? (
                'Crear cuenta'
              ) : (
                'Iniciar sesión'
              )}
            </button>

            {/* Back Button for Forgot Password */}
            {isForgotPassword && (
              <button
                type="button"
                className={styles.backButton}
                onClick={() => {
                  setIsForgotPassword(false);
                  setLocalError('');
                  setLocalSuccess('');
                }}
              >
                ← Volver
              </button>
            )}
          </form>

          {/* Toggle Sign Up / Sign In */}
          {!isForgotPassword && (
            <div className={styles.footer}>
              <p>
                {isSignUp ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
                <button
                  type="button"
                  className={styles.toggleButton}
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setLocalError('');
                    setPassword('');
                    setConfirmPassword('');
                  }}
                  disabled={isLoading}
                >
                  {isSignUp ? 'Inicia sesión' : 'Regístrate'}
                </button>
              </p>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className={styles.infoSection}>
          <h2>Bienvenido a SIGA FIUNA</h2>
          <p>
            Accede a tu información académica desde cualquier dispositivo. Consulta tu
            horario, notas, calendario académico y más.
          </p>
          <ul className={styles.features}>
            <li>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 0C4.5 0 0 4.5 0 10s4.5 10 10 10 10-4.5 10-10S15.5 0 10 0zm-1 15l-5-5 1.4-1.4L9 12.2l8.6-8.6L19 5l-10 10z"
                  fill="currentColor"
                />
              </svg>
              <span>Accede desde cualquier lugar</span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 0C4.5 0 0 4.5 0 10s4.5 10 10 10 10-4.5 10-10S15.5 0 10 0zm-1 15l-5-5 1.4-1.4L9 12.2l8.6-8.6L19 5l-10 10z"
                  fill="currentColor"
                />
              </svg>
              <span>Información segura</span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 0C4.5 0 0 4.5 0 10s4.5 10 10 10 10-4.5 10-10S15.5 0 10 0zm-1 15l-5-5 1.4-1.4L9 12.2l8.6-8.6L19 5l-10 10z"
                  fill="currentColor"
                />
              </svg>
              <span>Sincronización en la nube</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

