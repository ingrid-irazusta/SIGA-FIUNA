"use client";

import Card from "../components/Card";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useProfile, useSchedule, useEvaluations, useCurrentCourses } from "../lib/hooks";
import { saveProfile, saveCurrentCourses, saveMallaCache, saveNotas } from "../lib/supabase";
import { loadProfileAsync, saveProfileAsync, loadScheduleAsync, saveScheduleAsync, loadEvaluationsAsync, saveEvaluationsAsync, loadNotasAsync, saveNotasAsync, loadMallaCacheAsync, saveMallaCacheAsync, loadCurrentCoursesAsync, saveCurrentCoursesAsync } from "../lib/storage-adapter";

// Removido: SCHEDULE_KEY (ahora usa Supabase)
// Removido: PROFILE_KEY (ahora usa Supabase)
// Removido: CURRENT_COURSES_KEY (ahora usa Supabase)
// Removido: EVAL_KEY (ahora usa Supabase)
// Removido: MALLA_CACHE_PREFIX (ahora usa Supabase)
// Removido: NOTAS_PREFIX (ahora usa Supabase)

const CARRERAS = [
  "IngenierÃ­a GeogrÃ¡fica y Ambiental",
  "IngenierÃ­a ElectromecÃ¡nica",
  "IngenierÃ­a ElectrÃ³nica",
  "IngenierÃ­a MecÃ¡nica",
  "IngenierÃ­a MecatrÃ³nica",
  "IngenierÃ­a Industrial",
  "IngenierÃ­a Civil",
];

const DEFAULT_PROFILE = {
  alumno: "",
  ci: "",
  ingreso: "",
  malla: "2023",
  carrera: CARRERAS[0],
};

function normText(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function mallaCacheKey({ carrera, plan }) {
  return `${MALLA_CACHE_PREFIX}:${normText(carrera)}:${String(plan || "2023")}`;
}

function notasStorageKey({ carrera, plan, ci }) {
  const c = normText(carrera);
  const p = String(plan || "2023");
  const id = String(ci || "").trim();
  return id ? `${NOTAS_PREFIX}:${c}:${p}:${id}` : `${NOTAS_PREFIX}:${c}:${p}`;
}

function buildBaseNotasRows(mallaItems) {
  return (mallaItems || []).map((it) => ({
    id: `base:${Number(it?.semestre) || 0}:${normText(it?.materia)}`,
    base: true,
    semestre: Number(it?.semestre) || 0,
    materia: String(it?.materia || "").trim(),
    nota1: "",
    nota2: "",
    nota3: "",
  })).filter((r) => r.semestre > 0 && r.materia);
}

function computeNotasKpisFromRowsAndMalla(rows, mallaItems) {
  try {
    const items = Array.isArray(mallaItems) ? mallaItems : [];
    const total = items.filter((it) => Number(it?.semestre) > 0 && String(it?.materia || '').trim()).length;

    const baseSet = new Set();
    const aprobadaByMateria = new Map();
    const todasLasNotas = [];

    for (const r of (rows || [])) {
      const matKey = normText(r?.materia);
      if (!matKey) continue;
      if (r?.base) baseSet.add(matKey);

      const vals = [r?.nota1, r?.nota2, r?.nota3]
        .map((x) => (x === '' || x === null || typeof x === 'undefined' ? null : Number(x)))
        .filter((x) => Number.isFinite(x) && x >= 1 && x <= 5);

      for (const v of vals) todasLasNotas.push(v);
      if (vals.some((v) => v >= 2)) aprobadaByMateria.set(matKey, true);
    }

    const promedioNum = todasLasNotas.length ? (todasLasNotas.reduce((a, b) => a + b, 0) / todasLasNotas.length) : 0;
    const aprobadas = Array.from(baseSet).reduce((acc, k) => acc + (aprobadaByMateria.get(k) ? 1 : 0), 0);
    const totalBase = total || baseSet.size || 0;
    const progresoPct = totalBase ? (aprobadas / totalBase) * 100 : 0;
    const faltan = Math.max(0, totalBase - aprobadas);

    return {
      promedioNum,
      promedioStr: promedioNum ? promedioNum.toFixed(2).replace('.', ',') : '0,00',
      aprobadas,
      total: totalBase,
      progresoPct,
      faltan,
    };
  } catch {
    return { promedioNum: 0, promedioStr: '0,00', aprobadas: 0, total: 0, progresoPct: 0, faltan: 0 };
  }
}

async function syncMallaAndNotas({ carrera, malla, ci }) {
  // 1) Traer malla desde el backend (BD Maestra)
  const plan = malla;
  const r = await fetch(`/api/malla?carrera=${encodeURIComponent(carrera)}&plan=${encodeURIComponent(plan)}`);
  const data = await r.json().catch(() => null);
  if (!r.ok || !data?.ok) throw new Error(data?.error || "No se pudo leer la BD_Malla");

  const materias = Array.isArray(data?.materias) ? data.materias : [];
  const prepared = materias
    .map((m) => ({
      semestre: Number(m?.semestre) || 0,
      materia: String(m?.materia || "").trim(),
      requisitos: m?.requisitos,
      key: normText(m?.materia),
    }))
    .filter((x) => x.semestre > 0 && x.materia);

  // 2) Guardar cache de malla (lo usan Malla y Notas Finales)
  try {
    await saveMallaCacheAsync(carrera, plan, { ts: Date.now(), items: prepared });
  } catch {
    // ignore
  }

  // 3) Crear/actualizar NOTAS FINALES basado en esa malla (sin borrar extras)
  let existing = [];
  try {
    existing = (await loadNotasAsync(ci, carrera, plan)) || [];
  } catch {
    existing = [];
  }

  const baseRows = buildBaseNotasRows(prepared);
  const merged = (() => {
    const byKey = new Map();
    for (const r of existing) {
      const k = `${r?.base ? "base" : "extra"}:${Number(r?.semestre) || 0}:${normText(r?.materia)}`;
      if (!byKey.has(k)) byKey.set(k, r);
    }
    const out = [];
    for (const b of baseRows) {
      const k = `base:${Number(b.semestre) || 0}:${normText(b.materia)}`;
      const prev = byKey.get(k);
      if (prev) {
        out.push({
          ...b,
          nota1: prev.nota1 ?? "",
          nota2: prev.nota2 ?? "",
          nota3: prev.nota3 ?? "",
        });
        byKey.delete(k);
      } else {
        out.push(b);
      }
    }
    // conservar filas extras
    for (const r of existing) if (!r?.base) out.push(r);
    out.sort((a, b) => {
      if ((a.semestre || 0) !== (b.semestre || 0)) return (a.semestre || 0) - (b.semestre || 0);
      if (a.base !== b.base) return a.base ? -1 : 1;
      return String(a.materia || "").localeCompare(String(b.materia || ""));
    });
    return out;
  })();

  try {
    await saveNotasAsync(ci, carrera, plan, merged);
  } catch {
    // ignore
  }

  return { total: baseRows.length };
}

// NOTE: schedule/profile/currentCourses are loaded via async adapter in effects below.

async function syncEvaluacionesWithCoursesAsync(courses) {
  try {
    const prevRows = (await loadEvaluationsAsync()) || [];
    const byMat = new Map((Array.isArray(prevRows) ? prevRows : []).map((r) => [normText(r?.materia), r]));
    const nextRows = (courses || [])
      .map((c) => {
        const materia = String(c?.mat || c?.nombre || "").trim();
        const key = normText(materia);
        const old = byMat.get(key);
        return {
          materia,
          p1: old?.p1 || { fecha: "", hora: "" },
          p2: old?.p2 || { fecha: "", hora: "" },
          f1: old?.f1 || { fecha: "", hora: "" },
          f2: old?.f2 || { fecha: "", hora: "" },
          f3: old?.f3 || { fecha: "", hora: "" },
        };
      })
      .filter((r) => r.materia);

    await saveEvaluationsAsync(nextRows);
    try { window.dispatchEvent(new Event('fiuna_evaluaciones_updated')); } catch {}
  } catch {
    // ignore
  }
}

function dayIdFromISO(iso) {
  // iso: YYYY-MM-DD
  try {
    const d = new Date(iso + "T00:00:00");
    const js = d.getDay(); // 0..6 (Dom..Sab)
    if (js === 0) return 6; // Domingo -> tratamos como SÃ¡bado/6 para no romper
    return Math.min(js, 6); // Lun=1..Sab=6
  } catch {
    return 1;
  }
}

const MOCK = {
  alumno: "â€”",
  ci: "â€”",
  carrera: "IngenierÃ­a GeogrÃ¡fica y Ambiental",
  malla: "2023",
  ingreso: "â€”",
  aprobadas: 6,
  total: 61,
  promedio: "1,86",
  itan: 55,
  proximoExamen: {
    materia: "Electricidad y Magnetismo",
    tipo: "1er Parcial",
    fecha: "sÃ¡bado, 24 de enero de 2026",
    dias: 11,
    hora: "00:00",
  },
  clasesHoy: [
    { h: "7:30 - 10:20", mat: "ELECTRICIDAD Y MAGNETISMO", tag: "TEO-B", prof: "ING. C. PANIAGUA", estado: "AÃºn no llegÃ³", aula: "F5" },
    { h: "10:30 - 12:20", mat: "ELECTRICIDAD Y MAGNETISMO", tag: "PRAC-B", prof: "PIRIS", estado: "AÃºn no llegÃ³", aula: "F5" },
    { h: "14:00 - 14:50", mat: "ESTATICA", tag: "prac-c", prof: "", estado: "", aula: "No hallada" },
  ],
  materiasEnCurso: [
    { sem: 3, mat: "electricidad y magnetismo" },
    { sem: 4, mat: "MATEMATICAS" },
    { sem: 6, mat: "HOLA" },
    { sem: 7, mat: "CHAU" },
  ],
};

function safeParse(raw){
  try { return JSON.parse(raw); } catch { return null; }
}

function parseDateTime(dateYMD, timeHM){
  if (!dateYMD) return null;
  const t = (timeHM || "00:00").trim();
  const dt = new Date(`${dateYMD}T${t}:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function daysDiffFromToday(dt){
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

function formatDMY(dateYMD){
  if (!dateYMD) return "";
  const [y,m,d] = String(dateYMD).split("-");
  if (!y||!m||!d) return String(dateYMD);
  return `${d}/${m}/${y}`;
}

function computeNextExamFromRows(arr){
  if (!Array.isArray(arr)) return null;

  const TYPES = [
    { key: 'p1', label: '1er Parcial' },
    { key: 'p2', label: '2do Parcial' },
    { key: 'f1', label: 'Final 1' },
    { key: 'f2', label: 'Final 2' },
    { key: 'f3', label: 'Final 3' },
  ];

  let best = null;
  for (const r of arr){
    for (const t of TYPES){
      const cell = r?.[t.key];
      const fecha = cell?.fecha || "";
      const hora = cell?.hora || "";
      const dt = parseDateTime(fecha, hora);
      if (!dt) continue;
      const dias = daysDiffFromToday(dt);
      if (dias < 0) continue; // solo futuro o hoy
      const cand = { materia: r?.materia || "", tipo: t.label, fecha, hora, dt, dias };
      if (!best || cand.dt.getTime() < best.dt.getTime()) best = cand;
    }
  }
  if (!best) return null;
  return {
    materia: best.materia,
    tipo: best.tipo,
    fecha: formatDMY(best.fecha),
    hora: best.hora || "â€”",
    dias: best.dias,
  };
}

export default function Page() {
  // Modo prueba (Ãºtil en receso): permite elegir una fecha manual para probar aulas/calendario
  // sin depender estrictamente del â€œhoyâ€ real.
  // IMPORTANTE: NO usamos toISOString() porque usa UTC y puede correrse de dÃ­a en Paraguay.
  // Esto era la causa mÃ¡s comÃºn de que "Clases de hoy" muestre materias cuando en realidad
  // hoy no hay clases (te toma el dÃ­a siguiente en UTC).
  const nowLocal = new Date();
  const pad2 = (n) => String(n).padStart(2, "0");
  const todayISO = `${nowLocal.getFullYear()}-${pad2(nowLocal.getMonth() + 1)}-${pad2(nowLocal.getDate())}`;
  const [useTestDate, setUseTestDate] = useState(false);
  const [testDateISO, setTestDateISO] = useState(todayISO);

  // Hydration-safe: solo leemos localStorage luego del primer render en cliente.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [todayAcademic, setTodayAcademic] = useState({ loading: true, events: [] });

  // IMPORTANT (Next.js hydration): no leer localStorage durante el render inicial.
  // El server siempre renderiza sin localStorage; si el cliente lee en el primer render,
  // aparece el error "Text content does not match server-rendered HTML".
  const [schedule, setSchedule] = useState(null);

  // Perfil:
  // - draft: lo que el usuario edita
  // - locked: lo que la app usa (se actualiza SOLO al tocar "Cargar Datos")
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [profileDraft, setProfileDraft] = useState(DEFAULT_PROFILE);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSavedToast, setProfileSavedToast] = useState("");
  // Materias en curso (se guarda en localStorage). Base para PROCESO/NOTAS.
  const [currentCourses, setCurrentCourses] = useState([]);
  // IMPORTANTE: no guardamos en localStorage hasta terminar la hidrataciÃ³n inicial.
  // Si no, el primer render ([]) pisa el storage y parece que â€œse borra al cambiar de pestaÃ±aâ€.
  const coursesHydrated = useRef(false);
  const [coursesToast, setCoursesToast] = useState("");
  const [nextExam, setNextExam] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = await loadProfileAsync();
        if (saved) {
          const merged = {
            ...DEFAULT_PROFILE,
            ...saved,
            malla: saved.malla === "2013" || saved.malla === "2023" ? saved.malla : DEFAULT_PROFILE.malla,
            carrera: CARRERAS.includes(saved.carrera) ? saved.carrera : DEFAULT_PROFILE.carrera,
          };
          setProfile(merged);
          setProfileDraft(merged);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    // PrÃ³ximo examen: se alimenta desde la pestaÃ±a EVALUACIONES (adapter).
    const recompute = async () => {
      try {
        const rows = await loadEvaluationsAsync();
        setNextExam(computeNextExamFromRows(Array.isArray(rows) ? rows : []));
      } catch {
        setNextExam(null);
      }
    };
    recompute();
    const onStorage = () => { recompute(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('fiuna_evaluaciones_updated', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('fiuna_evaluaciones_updated', onStorage);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = await loadCurrentCoursesAsync();
        if (saved && saved.length) {
          const clean = saved
            .map((x) => ({
              sem: Number(x?.sem) || 1,
              mat: String(x?.mat || "").trim(),
              firma: String(x?.firma || "").trim(),
            }))
            .filter((x) => x.mat);
          setCurrentCourses(clean);
        }
      } catch {
        // ignore
      } finally {
        coursesHydrated.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    // Carga inicial del horario (solo cliente) para que el primer render coincida con el server.
    (async () => {
      try {
        const sched = await loadScheduleAsync();
        setSchedule(sched || {});
      } catch {
        setSchedule({});
      }
    })();
  }, []);

  // Nota: Quitamos el auto-scroll mÃ³vil (evita saltos/espacios raros en algunos navegadores).

  // IMPORTANTE: ya NO guardamos el perfil en cada cambio.
  // Solo se guarda y se aplica cuando el usuario toca "Cargar Datos".
  const [aulasOn, setAulasOn] = useState(false);
  const [aulasLoading, setAulasLoading] = useState(false);
  const [aulasInfo, setAulasInfo] = useState({});
  const [aulasError, setAulasError] = useState("");
  // Estado visual del botÃ³n (sin countdown): loading mÃ­nimo 3s + "verde" 2s al finalizar.
  const [aulasBtnState, setAulasBtnState] = useState("idle");

  const effectiveDateISO = useTestDate ? testDateISO : todayISO;

  const parseTipoSeccion = (tag = "") => {
    // Soporta tags histÃ³ricos (TEO-A/PRAC-B) y el nuevo formato (T-A/P-B)
    const t = String(tag).toUpperCase().trim();
    const parts = t.split("-");
    const rawTipo = (parts[0] || "").trim();
    const tipo = rawTipo === "PRAC" ? "P" : rawTipo === "TEO" ? "T" : (rawTipo === "P" ? "P" : rawTipo === "T" ? "T" : "");
    const seccion = parts[1] ? parts[1].trim() : "";
    return { tipo, seccion };
  };

  const aulasKey = (c) =>
    `${c?.horaInicio || ""}|${c?.horaFin || ""}|${c?.materia || ""}|${c?.tag || ""}`;

  const refreshAulas = async () => {
    const startedAt = Date.now();
    let shouldShowSuccess = false;
    try {
      setAulasError("");
      setAulasLoading(true);
      setAulasBtnState("loading");

      if (!clasesBase.length) {
        const msg = "Hoy no hay clases cargadas en tu Horario, por eso no se consultan aulas.";
        setAulasError(msg);
        if (typeof window !== "undefined") window.alert(msg);
        return;
      }

      // Pedimos TODO en un solo request (la API ya cachea el CSV 60s para no pegarle de mas).
      const payload = {
        classes: clasesBase.map((c) => ({
            key: aulasKey(c),
            materia: c.materia,
            tipo: c.tipo,
            seccion: c.seccion,
            horaInicio: c.horaInicio,
          })),
      };

      const r = await fetch("/api/aulas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data = null;
      try {
        data = await r.json();
      } catch {
        data = null;
      }

      if (!r.ok || data?.ok === false) {
        const base = data?.error || data?.message || "No se pudo conectar a la BD de aulas";
        const causes =
          "\n\nPosibles causas:\n" +
          "â€¢ Tu Google Sheet NO estÃ¡ pÃºblico (Compartir â†’ Cualquier persona con el enlace â†’ Lector).\n" +
          "â€¢ El gid no corresponde a la hoja que contiene BD_Aulas (si tenÃ©s mÃ¡s de una pestaÃ±a).\n" +
          "â€¢ El CSV devuelve HTML de login (pasa cuando no es pÃºblico).\n" +
          "â€¢ CambiÃ³ la estructura de columnas (D,E,F,H,I,J,L,M).\n" +
          "â€¢ Problema temporal de red / Google / bloqueo por extensiones.\n";
        const debug = `\nDebug: HTTP ${r.status}${data?.debug ? ` â€¢ ${data.debug}` : ""}`;
        const msg = `${base}${causes}${debug}`;
        setAulasError(msg);
        // Aviso visible inmediato (sin cambiar tu layout: alert nativo)
        if (typeof window !== "undefined") window.alert(msg);
        // No sobre-escribimos aulasInfo si fallÃ³.
        return;
      }

      if (data?.results && typeof data.results === "object") setAulasInfo(data.results);

      // Marcamos Ã©xito para pintar el botÃ³n en verde (sin nÃºmeros).
      shouldShowSuccess = true;
      setAulasOn(true);
    } catch (e) {
      const msg =
        "No se pudo conectar a la BD de aulas.\n\n" +
        "Posibles causas:\n" +
        "â€¢ Tu Google Sheet no estÃ¡ pÃºblico (lector).\n" +
        "â€¢ Bloqueo de red (extensiones / antivirus / firewall).\n" +
        "â€¢ CaÃ­da temporal de Google.\n\n" +
        `Debug: ${e?.message || "Error"}`;
      setAulasError(msg);
      console.error(e);
      if (typeof window !== "undefined") window.alert(msg);
    } finally {
      // Mantener el estado de "cargando" al menos 3s (sensaciÃ³n de control, sin countdown).
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, 3000 - elapsed);
      if (wait) await new Promise((res) => setTimeout(res, wait));

      setAulasLoading(false);

      if (shouldShowSuccess) {
        setAulasBtnState("success");
        if (typeof window !== "undefined") {
          window.clearTimeout(window.__fiunaAulasBtnT);
          window.__fiunaAulasBtnT = window.setTimeout(() => setAulasBtnState("idle"), 2000);
        } else {
          setAulasBtnState("idle");
        }
      } else {
        setAulasBtnState("idle");
      }
    }
  };

  useEffect(() => {
    if (!aulasOn) return;
    refreshAulas();
    const t = setInterval(refreshAulas, 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aulasOn]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/academic-today?date=${encodeURIComponent(effectiveDateISO)}`, { cache: "no-store" });
        const data = await r.json();
        if (!alive) return;
        setTodayAcademic({ loading: false, events: Array.isArray(data.events) ? data.events : [] });
      } catch (e) {
        if (!alive) return;
        setTodayAcademic({ loading: false, events: [] });
      }
    })();
    return () => { alive = false; };
  }, [effectiveDateISO]);

  const [notasKpis, setNotasKpis] = useState({ promedioStr: '0,00', aprobadas: 0, total: 0, progresoPct: 0, faltan: 0 });

  useEffect(() => {
    if (!mounted) return;
    if (!profile?.carrera) {
      setNotasKpis({ promedioStr: '0,00', aprobadas: 0, total: 0, progresoPct: 0, faltan: 0 });
      return;
    }
    try {
      setNotasKpis(computeNotasKpis({ carrera: profile.carrera, plan: profile.malla, ci: profile.ci }));
    } catch {
      setNotasKpis({ promedioStr: '0,00', aprobadas: 0, total: 0, progresoPct: 0, faltan: 0 });
    }
  }, [mounted, profile?.carrera, profile?.malla, profile?.ci]);

  const progreso = Math.round(notasKpis.progresoPct || 0);

  // Normaliza clases para el conector de aulas.
  // En la UI â€œclases de hoyâ€ venÃ­an como { h, mat, tag, prof }, pero el API espera
  // { materia, tipo, seccion, horaInicio }.
  const clasesBase = useMemo(() => {
    const sched = schedule;
    const dayId = dayIdFromISO(effectiveDateISO);

    // 1) Preferimos el horario del usuario (pestaÃ±a "Horario de Clases")
    const fromUser = sched?.[dayId];
    // IMPORTANTE: si el usuario no cargÃ³ horario, NO mostramos datos mock.
    const list = Array.isArray(fromUser) && fromUser.length ? fromUser : [];

    return list.map((c) => {
      // Clases del usuario vienen como {materia,tipo,seccion,inicio,fin,prof}
      const materia = String(c.materia ?? c.mat ?? "").trim();
      const tipoRaw = String(c.tipo || "").toUpperCase().trim();
      const tipo = tipoRaw === "TEO" ? "T" : tipoRaw === "PRAC" ? "P" : (tipoRaw === "T" ? "T" : tipoRaw === "P" ? "P" : "T");
      const seccion = String(c.seccion || "").trim().toUpperCase();
      const inicio = String(c.inicio ?? "").trim();
      const fin = String(c.fin ?? "").trim();

      // Para compatibilidad con el UI actual (h/mat/tag/prof)
      const h = inicio && fin ? `${inicio} - ${fin}` : String(c.h || "");
      const tag = seccion ? `${tipo}-${seccion}` : tipo;

      const [iniRaw, finRaw] = String(h).split("-").map((s) => s.trim());

      return {
        // mantenemos campos posibles del MOCK
        ...c,
        h,
        mat: materia,
        tag,
        prof: c.prof || "â€”",

        // y los campos esperados por el conector de aulas
        materia,
        tipo,
        seccion,
        horaInicio: iniRaw || inicio || "",
        horaFin: finRaw || fin || "",
      };
    });
  }, [effectiveDateISO, schedule]);

  // Normaliza las clases â€œde hoyâ€ para que el conector de aulas reciba los campos esperados.
  // --- Calendario acadÃ©mico (eventos del dÃ­a) ---
  const academicEvents = Array.isArray(todayAcademic.events) ? todayAcademic.events : [];
  const academicNote = todayAcademic.loading ? "" : academicEvents.join(" â€¢ ");
  const isNoClassDay = !todayAcademic.loading && academicEvents.some((t) =>
    /feriado|suspensi|receso|vacaci|pausa|asÃºeto|asueto/i.test(String(t || ""))
  );

  const clasesHoy = !isNoClassDay ? clasesBase : [];
  const clasesHoyUI = clasesHoy.map((c) => {
    const key = aulasKey(c);
    const info = aulasInfo[key];
    const aula = aulasOn ? (info?.found ? info.aula : "â€”") : c.aula;
    const estado = aulasOn
      ? (info?.found ? info.estado : { icon: "â„¹ï¸", text: "Sin coincidencia", code: "NC" })
      : null;
    const prof =
      aulasOn && info?.found && estado?.code === "R" && info?.reemplazo
        ? `${info.reemplazo} (Suplente)`
        : c.prof;
    const obs = aulasOn && info?.found ? info.observacion : "";
    return { ...c, _aula: aula, _estado: estado, _prof: prof, _obs: obs };
  });

  const prettyDate = useMemo(() => {
    try {
      const d = new Date(`${effectiveDateISO}T00:00:00`);
      return d.toLocaleDateString("es-PY", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return effectiveDateISO;
    }
  }, [effectiveDateISO]);

  const addCourseRow = () => {
    setCurrentCourses((prev) => [...prev, { sem: "", mat: "", firma: "" }]);
  };

  const updateCourseRow = (idx, patch) => {
    setCurrentCourses((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeCourseRow = (idx) => {
    setCurrentCourses((prev) => prev.filter((_, i) => i !== idx));
  };

  const normalizeCourses = () => {
    // Limpieza: quitar filas vacias, recortar, y ordenar por semestre.
    setCurrentCourses((prev) => {
      const clean = (prev || [])
        .map((x) => ({
          sem: String(x?.sem ?? "").trim(),
          mat: String(x?.mat ?? "").trim(),
          firma: String(x?.firma ?? "").trim(),
        }))
        .filter((x) => x.mat);

      clean.sort((a, b) => (Number(a.sem) || 999) - (Number(b.sem) || 999));
      return clean;
    });
  };

  const onGuardarMaterias = async () => {
    // Guardar lista de materias en curso (Inicio) para que Proceso/Evaluaciones/Notas la lean
    // IMPORTANTE: NO usar setState como â€œfuenteâ€ del snapshot (es async).
    // Si no, se termina guardando [] en localStorage y parece que â€œse borra todoâ€.
    const clean = (currentCourses || [])
      .map((x) => ({
        sem: String(x?.sem ?? "").trim(),
        mat: String(x?.mat ?? "").trim(),
        firma: String(x?.firma ?? "").trim(),
      }))
      .filter((x) => x.mat);
    clean.sort((a, b) => (Number(a.sem) || 999) - (Number(b.sem) || 999));

    setCurrentCourses(clean);

    try { await saveCurrentCoursesAsync(clean); } catch {}
    // En un solo click: sincroniza tambiÃ©n Horario de ExÃ¡menes.
    try { await syncEvaluacionesWithCoursesAsync(clean); } catch {}
    // Evento para que otras pestaÃ±as sincronicen
    try { window.dispatchEvent(new Event('fiuna_current_courses_updated')); } catch {}
    try { window.dispatchEvent(new Event('fiuna_courses_updated')); } catch {}

    setCoursesToast(clean.length ? `Guardado (${clean.length} materias)` : "No hay materias para guardar");
    setTimeout(() => setCoursesToast(""), 2400);
  };


  const onCargarDatos = async () => {
    // Aplicar el borrador como perfil activo + persistir + sincronizar malla/notas.
    const clean = {
      ...DEFAULT_PROFILE,
      ...profileDraft,
      malla: profileDraft.malla === "2013" || profileDraft.malla === "2023" ? profileDraft.malla : "2023",
      carrera: CARRERAS.includes(profileDraft.carrera) ? profileDraft.carrera : CARRERAS[0],
    };

    setProfileSaving(true);
    setProfileSavedToast("");
    try {
      setProfile(clean);
      try {
        await saveProfileAsync(clean);
        // Avisar al header global que el perfil cambiÃ³.
        try { window.dispatchEvent(new Event('fiuna_profile_updated')); } catch {}
      } catch {
        // ignore
      }

      const res = await syncMallaAndNotas({ carrera: clean.carrera, malla: clean.malla, ci: clean.ci });
      setProfileSavedToast(`âœ… Datos cargados (${res?.total || 0} materias)`);
      setTimeout(() => setProfileSavedToast(""), 2600);
    } catch (e) {
      setProfileSavedToast(`âš ï¸ ${e?.message || "No se pudo cargar"}`);
      setTimeout(() => setProfileSavedToast(""), 3200);
    } finally {
      setProfileSaving(false);
    }
  };


  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="dashGrid">
        {/* Orden lÃ³gico (mobile): Perfil -> Avance -> Clases -> PrÃ³ximo -> Avisos -> Materias */}
        <div className="blockProfile">
          <Card
            title={<span className="sectionLabel">ðŸŽ“ PERFIL DEL ESTUDIANTE</span>}
            right={
              <button
                className="btn btnPrimary"
                onClick={onCargarDatos}
                disabled={profileSaving}
                style={{ padding: "8px 10px", fontWeight: 950 }}
                title="Guarda el perfil y sincroniza Malla + Notas Finales"
              >
                {profileSaving ? "Cargando..." : "Cargar Datos"}
              </button>
            }
          >
            <div className="smallRow">
              <div className="smallKey">Alumno:</div>
              <input
                className="fakeInput profileField"
                value={profileDraft.alumno}
                onChange={(e) => setProfileDraft((p) => ({ ...p, alumno: e.target.value }))}
                placeholder="Nombre y apellido"
                aria-label="Nombre del alumno"
              />
            </div>
            <div className="smallRow">
              <div className="smallKey">C.I. NÂ°:</div>
              <input
                className="fakeInput profileField"
                value={profileDraft.ci}
                onChange={(e) => setProfileDraft((p) => ({ ...p, ci: e.target.value }))}
                placeholder="CI"
                inputMode="numeric"
                aria-label="CÃ©dula de identidad"
              />
            </div>
            <div className="smallRow">
              <div className="smallKey">CARRERA:</div>
              <div className="fakeInput fakeSelect" aria-label="Carrera">
                <select
                  className="profileSelect"
                  value={profileDraft.carrera}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, carrera: e.target.value }))}
                >
                  {CARRERAS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <span className="muted">â–¾</span>
              </div>
            </div>
            <div className="smallRow">
              <div className="smallKey">MALLA:</div>
              <div className="fakeInput fakeSelect" aria-label="Malla">
                <select
                  className="profileSelect"
                  value={profileDraft.malla}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, malla: e.target.value }))}
                >
                  <option value="2013">2013</option>
                  <option value="2023">2023</option>
                </select>
                <span className="muted">â–¾</span>
              </div>
            </div>
            <div className="smallRow">
              <div className="smallKey">INGRESO:</div>
              <input
                className="fakeInput profileField"
                value={profileDraft.ingreso}
                onChange={(e) => setProfileDraft((p) => ({ ...p, ingreso: e.target.value }))}
                placeholder="AÃ±o (ej: 2026)"
                inputMode="numeric"
                aria-label="AÃ±o de ingreso"
              />
            </div>

            <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
              {profileSavedToast ? profileSavedToast : ""}
            </div>
          </Card>
        </div>

        <div className="blockProximo">
          <Card title={<span className="sectionLabel">â³ PRÃ“XIMO EXAMEN</span>}>
            <div className="bigDays">{nextExam ? `${nextExam.dias} dÃ­as` : "â€”"}</div>
            <div className="centerNote">DÃ­as Restantes</div>
            <div style={{ height: 10 }} />
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 950 }}>ðŸ“Œ {nextExam ? nextExam.tipo : "Sin examen"}</div>
              <div style={{ fontWeight: 900, textTransform: "lowercase" }}>{(nextExam ? nextExam.materia : "CargÃ¡ tus fechas en Horario de ExÃ¡menes").toLowerCase()}</div>
              <div className="metaLine">
                <span>ðŸ—“ï¸ {nextExam ? nextExam.fecha : "â€”"}</span>
                <span>â° {nextExam ? nextExam.hora : "â€”"}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="blockMaterias">
          <Card
            title={<span className="sectionLabel">ðŸ“š Materias en curso</span>}
            right={
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button className="btn" onClick={addCourseRow} style={{ padding: "8px 10px", fontSize: 12 }}>
                  + Agregar
                </button>
                <button
                  className="btn btnPrimary"
                  onClick={onGuardarMaterias}
                  style={{ padding: "8px 10px", fontSize: 12 }}
                  title="Guardar/ordenar y usar esta lista para Proceso de EvaluaciÃ³n"
                >
                  Guardar
                </button>
              </div>
            }
          >
            <table className="tableMini" aria-label="Materias en curso">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Semestre</th>
                  <th>Materia</th>
                  <th style={{ width: 120 }}>Firma</th>
                </tr>
              </thead>
              <tbody>
                {currentCourses.map((m, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        className="fakeInput profileField"
                        style={{ padding: "6px 8px", width: 70 }}
                        value={m.sem}
                        inputMode="numeric"
                        placeholder="1"
                        onChange={(e) => updateCourseRow(idx, { sem: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const el = document.querySelector(`[data-course-mat="${idx}"]`);
                            if (el) el.focus();
                          }
                        }}
                        data-course-sem={idx}
                        aria-label={`Semestre fila ${idx + 1}`}
                      />
                    </td>
                    <td>
                      <input
                        className="fakeInput profileField"
                        style={{ padding: "6px 8px", width: "100%" }}
                        value={m.mat}
                        placeholder="Nombre de materia"
                        onChange={(e) => updateCourseRow(idx, { mat: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const el = document.querySelector(`[data-course-firma="${idx}"]`);
                            if (el) el.focus();
                          }
                        }}
                        data-course-mat={idx}
                        aria-label={`Materia fila ${idx + 1}`}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
                        <div className="fakeInput fakeSelect" style={{ padding: "6px 8px", minWidth: 110 }}>
                          <select
                            className="profileSelect"
                            value={m.firma || ""}
                            onChange={(e) => updateCourseRow(idx, { firma: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                // Si es la Ãºltima fila, agregamos una nueva; si no, bajamos a la siguiente
                                const nextIdx = idx + 1;
                                if (nextIdx >= currentCourses.length) {
                                  addCourseRow();
                                  setTimeout(() => {
                                    const el = document.querySelector(`[data-course-sem="${nextIdx}"]`);
                                    if (el) el.focus();
                                  }, 0);
                                } else {
                                  const el = document.querySelector(`[data-course-sem="${nextIdx}"]`);
                                  if (el) el.focus();
                                }
                              }
                            }}
                            data-course-firma={idx}
                            aria-label={`Firma fila ${idx + 1}`}
                          >
                            <option value="">â€”</option>
                            <option value="SI">SI</option>
                            <option value="NO">NO</option>
                          </select>
                          <span className="muted">â–¾</span>
                        </div>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => removeCourseRow(idx)}
                          style={{ padding: "6px 8px", fontSize: 12 }}
                          aria-label="Eliminar fila"
                          title="Eliminar"
                        >
                          âœ•
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
            </table>
            {!currentCourses.length ? (
              <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                AÃºn no cargaste materias. TocÃ¡ <b>+ Agregar</b> para crear la primera fila.
              </div>
            ) : null}
            <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
              Esta lista define cuÃ¡ntas tarjetas se generan en <b>Proceso de EvaluaciÃ³n</b> y <b>Notas Finales</b>.
              {coursesToast ? <span style={{ marginLeft: 10 }}>{coursesToast}</span> : null}
            </div>
          </Card>
        </div>

        <div className="blockAvance">
          <Card
            title={<span className="sectionLabel">ðŸš€ AVANCE ACADÃ‰MICO</span>}
            right={<span className="pill mono">Promedio&nbsp;{notasKpis.promedioStr}</span>}
          >
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 900, color: "rgba(15,23,42,0.7)" }}>Aprobadas</div>
                <div style={{ fontWeight: 950, fontSize: 18 }}>{notasKpis.aprobadas}/{notasKpis.total}</div>
              </div>

              <div className="progressBar" aria-label="Barra de progreso">
                <div className="progressFill" style={{ width: `${progreso}%` }} />
              </div>

              <div className="metaLine" style={{ justifyContent: "space-between" }}>
                <span>Progreso: <span className="mono">{progreso}%</span></span>
                <span>Faltan: <span className="mono">{notasKpis.faltan}</span></span>
              </div>
            </div>
          </Card>
        </div>

        <div className="blockClases" id="clases-hoy">
          <Card
            title={<span className="sectionLabel">ðŸ—“ï¸ CLASES DE HOY</span>}
            right={
              <button
                className={`btn btnPrimary${aulasBtnState === "success" ? " btnSuccess" : ""}`}
                onClick={refreshAulas}
                disabled={aulasLoading}
                style={{ padding: "8px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                {aulasLoading ? <span className="miniSpinner" aria-hidden /> : null}
                <span>Actualizar</span>
              </button>
            }
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div style={{ fontStyle: "italic", textAlign: "left", fontWeight: 900 }}>
                {prettyDate}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={useTestDate}
                    onChange={(e) => setUseTestDate(e.target.checked)}
                  />
                  Modo prueba
                </label>
                {useTestDate && (
                  <input
                    type="date"
                    value={testDateISO}
                    onChange={(e) => setTestDateISO(e.target.value)}
                    className="input"
                    style={{ maxWidth: 160, padding: "8px 10px" }}
                  />
                )}
              </div>
            </div>

            {aulasError ? (
              <div className="metaLine" style={{ marginBottom: 10, opacity: 0.95 }}>
                <span>âš ï¸ {aulasError.split("\n")[0]}</span>
              </div>
            ) : null}

            <div className="todayList">
              {!todayAcademic.loading && isNoClassDay && (
                <div className="classItem" style={{ borderStyle: "dashed", opacity: 0.95 }}>
                  <div className="timeCol">â€”</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 950 }}>ðŸ“… Hoy no hay clases</div>
                    <div className="metaLine"><span>{academicNote || "Evento acadÃ©mico"}</span></div>
                  </div>
                </div>
              )}
              {!isNoClassDay && academicNote && (
                <div className="classItem" style={{ opacity: 0.9 }}>
                  <div className="timeCol">ðŸ“Œ</div>
                  <div className="metaLine"><span><strong>Calendario acadÃ©mico:</strong> {academicNote}</span></div>
                </div>
              )}
              {!isNoClassDay && !clasesHoyUI.length && (
                <div className="classItem" style={{ borderStyle: "dashed", opacity: 0.95 }}>
                  <div className="timeCol">â€”</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 950 }}>ðŸŒ¿ DÃ­a libre</div>
                    <div className="metaLine"><span>Sin clases</span></div>
                  </div>
                </div>
              )}
              {clasesHoyUI.map((c, idx) => (
                <div className="classItem" key={idx}>
                  <div className="timeCol">{c.h}</div>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 950 }}>{c.mat} <span className="muted">({c.tag})</span></div>
                    <div className="metaLine">
                      <span>ðŸ‘¤ {c.prof || "â€”"}</span>
                      {c._estado?.text ? (
                        <span className={c._estado.icon === "âœ…" ? "badgeOk" : c._estado.icon === "âŒ" ? "badgeBad" : "badgeWarn"}>
                          {c._estado.icon} {c._estado.text}
                        </span>
                      ) : null}
                    </div>
                    <div className="metaLine">
                      <span>
                        ðŸ« Aula: <span className="mono">{c._aula || "â€”"}</span>
                      </span>
                    </div>
                    {c._obs ? (
                      <div className="metaLine">
                        <span>ðŸ“ {c._obs}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="blockAvisos">
          <Card className="fullWidth" title={<span className="sectionLabel">ðŸ§­ AVISOS</span>}>
            <div className="avisosBox">
              (Espacio reservado para avisos / recordatorios)
            </div>
          </Card>
        </div>

        <div className="blockLinks footerLinks fullWidth linksBox">ðŸ”— Enlaces Ãºtiles</div>
      </div>
    </div>
  );
}




