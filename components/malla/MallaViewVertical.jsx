"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MateriaCard from "./MateriaCard";
import { calcEstados, normText, parseRequisitos, isPlaceholderReq } from "./utils";

const PROFILE_KEY = "fiuna_os_profile_v1";
const MALLA_CACHE_PREFIX = "fiuna_os_malla_cache_v1";
const LOCAL_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

function loadProfile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? p : null;
  } catch {
    return null;
  }
}

function storageKeyForAprobadas({ carrera, plan, ci }) {
  const c = normText(carrera);
  const p = String(plan);
  const id = String(ci || "").trim();
  return id ? `fiuna_os_aprobadas_v1:${c}:${p}:${id}` : `fiuna_os_aprobadas_v1:${c}:${p}`;
}

function loadAprobadas(key) {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => normText(x)));
  } catch {
    return new Set();
  }
}

function saveAprobadas(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function groupBySemestre(items) {
  const m = new Map();
  for (const it of items) {
    const s = Number(it.semestre) || 0;
    if (s <= 0) continue;
    if (!m.has(s)) m.set(s, []);
    m.get(s).push(it);
  }
  const sems = Array.from(m.keys()).sort((a, b) => a - b);
  return { map: m, sems };
}

export default function MallaViewVertical() {
  // IMPORTANT (Next.js hydration): no leer localStorage durante el render inicial.
  // Usamos defaults y luego cargamos el perfil una vez montado el cliente.
  const [carrera, setCarrera] = useState("");
  const [plan, setPlan] = useState("2023");
  const [ci, setCi] = useState("");

  useEffect(() => {
    const p = loadProfile();
    if (!p) return;
    if (typeof p.carrera === "string") setCarrera(p.carrera);
    if (p.malla === "2013" || p.malla === "2023") setPlan(p.malla);
    if (typeof p.ci === "string") setCi(p.ci);
  }, []);

  const [mode, setMode] = useState("estricto");
  const [blockPlaceholders, setBlockPlaceholders] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const [radarKey, setRadarKey] = useState("");
  const [flashKeys, setFlashKeys] = useState(new Set());
  const [detailsItem, setDetailsItem] = useState(null);

  const aprobadasStorageKey = useMemo(
    () => storageKeyForAprobadas({ carrera, plan, ci }),
    [carrera, plan, ci]
  );
  const [aprobadas, setAprobadas] = useState(new Set());

  useEffect(() => {
    setAprobadas(loadAprobadas(aprobadasStorageKey));
  }, [aprobadasStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    saveAprobadas(aprobadasStorageKey, aprobadas);
  }, [aprobadasStorageKey, aprobadas]);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!carrera || !plan) {
        setError("Elegí tu Carrera y Malla en Inicio.");
        setLoading(false);
        return;
      }

      setError("");
      setRadarKey("");

      const cacheKey = `${MALLA_CACHE_PREFIX}:${normText(carrera)}:${String(plan)}`;
      let cacheUsed = false;
      let shouldRevalidate = true;

      if (typeof window !== "undefined") {
        try {
          const rawCache = localStorage.getItem(cacheKey);
          if (rawCache) {
            const parsed = JSON.parse(rawCache);
            const ts = Number(parsed?.ts) || 0;
            const cachedItems = Array.isArray(parsed?.items) ? parsed.items : null;
            if (cachedItems) {
              cacheUsed = true;
              if (Date.now() - ts < LOCAL_CACHE_TTL_MS) {
                shouldRevalidate = false;
                setItems(cachedItems);
                setLoading(false);
              } else {
                setItems(cachedItems);
              }
            }
          }
        } catch {
          // ignore
        }
      }

      if (!cacheUsed) setLoading(true);

      try {
        if (!shouldRevalidate && cacheUsed) return;
        const r = await fetch(`/api/malla?carrera=${encodeURIComponent(carrera)}&plan=${encodeURIComponent(plan)}`);
        const data = await r.json().catch(() => null);
        if (!r.ok || !data?.ok) {
          const msg = data?.error || "No se pudo leer la BD_Malla";
          throw new Error(msg);
        }

        const raw = Array.isArray(data.materias) ? data.materias : [];
        const prepared = raw
          .map((m) => {
            const materia = String(m.materia || "").trim();
            const reqList = parseRequisitos(m.requisitos);
            const key = normText(materia);
            const requisitosKeys = reqList.map((r) => normText(r));
            return {
              semestre: Number(m.semestre) || 0,
              materia,
              requisitos: reqList,
              key,
              requisitosKeys,
            };
          })
          .filter((x) => x.materia);

        if (!cancelled) setItems(prepared);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), items: prepared }));
          } catch {
            // ignore
          }
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Error inesperado");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [carrera, plan]);

  const { map: semMap, sems } = useMemo(() => groupBySemestre(items), [items]);

  const estados = useMemo(() => {
    return calcEstados({ items, aprobadasSet: aprobadas, strictMode: mode === "estricto", blockPlaceholders });
  }, [items, aprobadas, mode, blockPlaceholders]);

  const radarKeys = useMemo(() => {
    const s = new Set();
    if (!radarKey) return s;
    s.add(radarKey);
    const target = items.find((it) => it.key === radarKey);
    if (target) {
      for (const rk of target.requisitosKeys) s.add(rk);
    }
    return s;
  }, [radarKey, items]);

  const totals = useMemo(() => {
    const shown = items.filter((x) => (Number(x.semestre) || 0) > 0);
    const total = shown.length;
    let ok = 0;
    for (const it of shown) if (aprobadas.has(it.key)) ok++;
    return { total, ok };
  }, [items, aprobadas]);

  const tryToggle = (it) => {
    if (aprobadas.has(it.key)) {
      const next = new Set(aprobadas);
      next.delete(it.key);
      setAprobadas(next);
      return;
    }

    if (mode === "flexible") {
      const next = new Set(aprobadas);
      next.add(it.key);
      setAprobadas(next);
      return;
    }

    const missing = [];
    for (const rk of it.requisitosKeys) {
      if (!blockPlaceholders && isPlaceholderReq(rk)) continue;
      if (!aprobadas.has(rk)) missing.push(rk);
    }

    if (missing.length === 0) {
      const next = new Set(aprobadas);
      next.add(it.key);
      setAprobadas(next);
      return;
    }

    showToast("⛔ Faltan requisitos");
    const flash = new Set(missing);
    setFlashKeys(flash);
    setTimeout(() => setFlashKeys(new Set()), 2600);
  };

  const openDetails = (it) => {
    setDetailsItem(it);
    setRadarKey(it.key);
  };

  const closeDetails = () => {
    setDetailsItem(null);
    setRadarKey("");
  };

  return (
    <div className="grid">
      <div className="mallaToolbar">
        {/* Limpieza visual: los datos (carrera/plan/contadores) van en el recuadro superior */}

        <div className="mallaToolbarRight">
          <button className="btn btnPrimary" onClick={() => setMode((m) => (m === "estricto" ? "flexible" : "estricto"))}>
            Modo: {mode === "estricto" ? "Estricto" : "Flexible"}
          </button>

          <label className="checkMini" style={{ cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={blockPlaceholders}
              onChange={(e) => setBlockPlaceholders(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Placeholders bloquean
          </label>
        </div>
      </div>

      {toast ? <div className="mallaToast" role="status" aria-live="polite">{toast}</div> : null}

      {loading ? (
        <div className="muted">Cargando malla…</div>
      ) : error ? (
        <div className="mallaError">
          <div style={{ fontWeight: 900, marginBottom: 6 }}>No se pudo leer BD_Malla</div>
          <div className="muted" style={{ whiteSpace: "pre-wrap" }}>{error}</div>
        </div>
      ) : (
        <div className="mallaBoardV" onClick={closeDetails} aria-label="Malla por semestres (vertical)">
          {sems.map((s) => (
            <div key={s} className="mallaSemestreV">
              <div className="mallaSemestreHeader">
                <div className="mallaSemestreTitleV">{s}° semestre</div>
              </div>

              <div className="mallaGridV" onClick={(e) => e.stopPropagation()}>
                {(semMap.get(s) || []).map((it) => (
                  <MateriaCard
                    key={it.key}
                    item={it}
                    estado={estados.get(it.key)}
                    checked={aprobadas.has(it.key)}
                    onToggle={tryToggle}
                    onOpen={openDetails}
                    radarActive={radarKeys.has(it.key)}
                    flash={flashKeys.has(it.key)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {detailsItem ? (
        <div className="mallaModalOverlay" onClick={closeDetails} role="dialog" aria-modal="true">
          <div className="mallaModal" onClick={(e) => e.stopPropagation()}>
            <div className="mallaModalHeader">
              <div style={{ fontWeight: 950 }}>{detailsItem.materia}</div>
              <button type="button" className="btn" onClick={closeDetails} aria-label="Cerrar">✕</button>
            </div>

            {detailsItem.requisitos?.length ? (
              <div className="mallaReqList">
                <div className="muted" style={{ marginBottom: 8 }}>Requisitos</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {detailsItem.requisitos.map((r) => (
                    <li key={r} style={{ marginBottom: 4 }}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="muted">Esta materia no tiene requisitos registrados.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
