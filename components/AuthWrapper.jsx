'use client';

import { useAuth } from '@/lib/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';

export function AuthWrapper({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirigir a auth si no está autenticado y no está en /auth
  useEffect(() => {
    if (!loading && !isAuthenticated && pathname !== '/auth' && mounted) {
      router.push('/auth');
    }
  }, [isAuthenticated, loading, pathname, router, mounted]);

  // Si está en la página de auth, no envolver con AppShell
  if (pathname === '/auth') {
    return children;
  }

  // Si está cargando o no está autenticado, mostrar un loader
  if (loading || !isAuthenticated) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(255, 255, 255, 0.3)',
            borderTopColor: 'white',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        >
          <style>{`
            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Si está autenticado, envolver con AppShell
  return <AppShell>{children}</AppShell>;
}
