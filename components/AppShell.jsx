"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { loadProfileAsync } from "../lib/storage-adapter";
import { createPortal } from "react-dom";

const APP_TITLE = "SISTEMA INTELIGENTE DE GESTIÓN ACADÉMICA FIUNA";
const APP_VERSION = "v18";

// Profile will be loaded asynchronously from storage-adapter (Supabase/localStorage)

const navItems = [
  { href: "/", label: "Inicio" },
  { href: "/calendario-academico", label: "Calendario Académico" },
  { href: "/horario", label: "Horario de Clases" },
  { href: "/proceso", label: "Proceso de Evaluación" },
  { href: "/evaluaciones", label: "Horario de Exámenes" },
  { href: "/malla", label: "Malla Curricular" },
  { href: "/notas-finales", label: "Notas Finales" },
  { href: "/abaco", label: "Ábaco" }
];

function getPageLabel(pathname) {
  if (!pathname || pathname === "/") return "Inicio";
  const found = navItems.find((it) => pathname.startsWith(it.href) && it.href !== "/");
  return found?.label || "";
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [profileInfo, setProfileInfo] = useState({ carrera: "", malla: "" });

  const pageLabel = getPageLabel(pathname);
  // Header global estilo "Inicio":
  // - Barra celeste fuerte: título de la pestaña (en Inicio, el título general).
  // - Barra celeste claro: placeholder de info importante.
  const headerTop = pathname === "/" ? APP_TITLE : pageLabel;

  // Info importante: usar lo elegido en Inicio (Carrera + Malla)
  // (Se carga luego del montaje para evitar hydration mismatch).
  const headerInfo = useMemo(() => {
    const pieces = [APP_VERSION];
    if (profileInfo.carrera) pieces.push(profileInfo.carrera);
    if (profileInfo.malla) pieces.push(`Malla ${profileInfo.malla}`);
    // Si no hay nada aún, dejamos un placeholder simple.
    if (pieces.length === 1) pieces.push("Información importante");
    return pieces.join(" — ");
  }, [profileInfo]);

  // Cierra el menú al cambiar de página
  useEffect(() => { setNavOpen(false); }, [pathname]);

  // Mount flag (para Portal en móvil y para leer localStorage)
  useEffect(() => {
    setMounted(true);
    try {
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const narrow = window.innerWidth <= 980;
      const ua = navigator.userAgent || '';
      const mobileUA = /Mobi|Android|iPhone|iPad|iPod/.test(ua);
      const touchCapable = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
      // Nota: algunos móviles en “sitio de escritorio” reportan UA raro y ancho grande.
      // Si el dispositivo es táctil, forzamos el layout móvil.
      setIsMobile(Boolean(coarse || narrow || mobileUA || touchCapable));
    } catch {
      // ignore
    }
    (async () => {
      try {
        const p = await loadProfileAsync("");
        const carrera = String(p?.carrera || "").trim();
        const malla = String(p?.malla || "").trim();
        setProfileInfo({ carrera, malla });
      } catch {
        // ignore
      }
    })();

    // Escuchar cambios del perfil desde Inicio (mismo tab)
    const onProfileUpdated = async () => {
      try {
        const p = await loadProfileAsync("");
        const carrera = String(p?.carrera || "").trim();
        const malla = String(p?.malla || "").trim();
        setProfileInfo({ carrera, malla });
      } catch {
        // ignore
      }
    };
    window.addEventListener('fiuna_profile_updated', onProfileUpdated);
    return () => window.removeEventListener('fiuna_profile_updated', onProfileUpdated);
  }, []);

  // Drawer + overlay en un Portal para evitar que algún contenedor lo “corte” en móvil
  const drawerUI = (
    <>
      {navOpen && <div className="appOverlay" onClick={() => setNavOpen(false)} />}
      <aside className={`appSidebar ${navOpen ? "open" : ""}`} aria-label="Menú lateral">
        <div className="appSideHeader">
          <div className="appBrand">SIGA FIUNA</div>
          <button type="button" className="appCloseBtn" onClick={() => setNavOpen(false)} aria-label="Cerrar menú">✕</button>
        </div>

        <nav className="appNav">
          {navItems.map((it) => {
            const active = it.href === "/" ? pathname === "/" : pathname?.startsWith(it.href);
            return (
              <Link key={it.href} href={it.href} className={`appNavItem ${active ? "active" : ""}`} onClick={() => setNavOpen(false)}>
                {it.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );

  return (
    <div className={`appShellRoot ${isMobile ? "isMobileDevice" : ""}`}>
      {/* Topbar fija (siempre visible, incluso con scroll horizontal) */}
      <header className="appTopbar">
        <button
          type="button"
          className="appHamb"
          onClick={() => setNavOpen((v) => !v)}
          aria-label="Menú"
        >
          ☰
        </button>
        <div className="appBrand">SIGA FIUNA</div>
      </header>

      {/* Overlay + Drawer: Portal (evita que en móvil “no se vea”) */}
      {mounted ? createPortal(drawerUI, document.body) : null}

      <main className="main">
        <div className="mainInner">
          <div className="dashHeader">
            <div className="dashHeaderTop">{headerTop}</div>
</div>

          {children}
        </div>
      </main>

      <style jsx>{`
        .appShellRoot{
          min-height: 100vh;
          background: var(--bg);
          display: block;
        }

        /* Main */
        /* Dejamos espacio real para la topbar fija (56px) + un poco de aire */
        .main{ padding: 14px; padding-top: 68px; width: 100%; }
        .mainInner{ width: 100%; max-width: 100%; margin: 0; }
        @media (max-width: 520px){
          .main{ padding: 12px; padding-top: 66px; }
          .mainInner{ max-width: 100%; }
        }
      `}</style>
    </div>
  );
}
