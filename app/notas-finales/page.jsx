"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card";
import { loadProfileAsync, loadMallaCacheAsync, loadNotasAsync, saveNotasAsync, saveMallaCacheAsync } from "../../lib/storage-adapter";

const MALLA_CACHE_PREFIX = "fiuna_os_malla_cache_v1";
// v4: 3 oportunidades base + 3 extras automáticas si quitó 1-1-1 (nota4..nota6)
const NOTAS_PREFIX = "fiuna_os_notas_finales_v4";

function normText(s){
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function safeParse(raw){
  try{ return JSON.parse(raw); }catch{ return null; }
}



function storageKey({ carrera, plan, ci }){
  const c = normText(carrera);
  const p = String(plan || '2023');
  const id = String(ci || '').trim();
  return id ? `${NOTAS_PREFIX}:${c}:${p}:${id}` : `${NOTAS_PREFIX}:${c}:${p}`;
}

function mallaCacheKey({ carrera, plan }){
  return `${MALLA_CACHE_PREFIX}:${normText(carrera)}:${String(plan || '2023')}`;
}

function estadoFromNotas(...notas){
  const vals = (notas || [])
    .map((x) => (x === '' || x === null || typeof x === 'undefined' ? null : Number(x)))
    .filter((x) => Number.isFinite(x));

  if (!vals.length) return 'PENDIENTE';
  if (vals.some((v) => v >= 2)) return 'APROBADO';
  if (vals.some((v) => v === 1)) return 'AUN NO';
  return 'PENDIENTE';
}

function clampNotaInput(v){
  if (v === '') return '';
  const n = Number(v);
  if (Number.isNaN(n)) return '';
  const i = Math.round(n);
  if (i < 1) return 1;
  if (i > 5) return 5;
  return i;
}

function notasRowAll(r){
  return [r?.nota1, r?.nota2, r?.nota3, r?.nota4, r?.nota5, r?.nota6]
    .map((x) => (x === '' || x === null || typeof x === 'undefined' ? null : Number(x)))
    .filter((x) => Number.isFinite(x) && x >= 1 && x <= 5);
}

function hasExtraNotas(r){
  return typeof r?.nota4 !== 'undefined' || typeof r?.nota5 !== 'undefined' || typeof r?.nota6 !== 'undefined';
}

function ensureExtraNotas(r){
  if (hasExtraNotas(r)) return r;
  return { ...r, nota4: '', nota5: '', nota6: '' };
}

function stripExtraNotas(r){
  // Elimina las 3 notas extra cuando ya no se necesitan.
  const { nota4, nota5, nota6, ...rest } = r || {};
  return rest;
}

function shouldHaveExtras(r){
  const n1 = Number(r?.nota1);
  const n2 = Number(r?.nota2);
  const n3 = Number(r?.nota3);
  return n1 === 1 && n2 === 1 && n3 === 1;
}

function reconcileExtras(r){
  // Si quitó 1-1-1 -> habilita extras; si no -> las oculta y las borra.
  if (shouldHaveExtras(r)) return ensureExtraNotas(r);
  return hasExtraNotas(r) ? stripExtraNotas(r) : r;
}

function enforceSinglePass(row, changedKey) {
  // Regla:
  // - Puede haber varios "1" ANTES de aprobar.
  // - Al aparecer una nota >= 2, TODAS las notas a la derecha se vacían.
  // - Solo puede existir UNA nota >= 2.

  const orderAll = ["nota1","nota2","nota3","nota4","nota5","nota6"];

  // Solo usamos las notas que existen en ese row (nota4..6 a veces no existen)
  const order = orderAll.filter((k) => typeof row?.[k] !== "undefined");

  const toNum = (v) => {
    if (v === "" || v === null || typeof v === "undefined") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // 1) Determinar cuál es la nota "aprobada" (>=2) que se va a respetar
  const changedVal = toNum(row?.[changedKey]);
  let passKey = null;

  // Si el usuario acaba de escribir >=2, esa manda
  if (changedKey && changedVal !== null && changedVal >= 2) {
    passKey = changedKey;
  } else {
    // Si no, tomamos la primera >=2 que exista de izquierda a derecha
    for (const k of order) {
      const n = toNum(row?.[k]);
      if (n !== null && n >= 2) {
        passKey = k;
        break;
      }
    }
  }

  // 2) Si no hay aprobada, no tocamos nada
  if (!passKey) return row;

  // 3) Si hay aprobada, limpiamos:
  const passIdx = order.indexOf(passKey);
  const out = { ...row };

  for (let i = 0; i < order.length; i++) {
    const k = order[i];
    const n = toNum(out?.[k]);

    // Borra cualquier otra nota >=2 que no sea la elegida
    if (k !== passKey && n !== null && n >= 2) out[k] = "";

    // Borra todo lo que está a la derecha del aprobado (incluye 1)
    if (i > passIdx) out[k] = "";
  }

  return out;
}


function readMallaMaterias({ carrera, plan }){
  try{
    const raw = localStorage.getItem(mallaCacheKey({ carrera, plan }));
    const parsed = safeParse(raw);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    // Solo materias con semestre > 0
    const filtered = items
      .map((it) => ({
        semestre: Number(it?.semestre) || 0,
        materia: String(it?.materia || '').trim(),
      }))
      .filter((x) => x.semestre > 0 && x.materia);
    // Orden por semestre y luego por aparición
    filtered.sort((a,b)=> a.semestre - b.semestre);
    return filtered;
  }catch{ return []; }
}

function buildBaseRows(mallaItems){
  // Cada materia de la malla -> una fila base
  return mallaItems.map((it) => ({
    id: `base:${it.semestre}:${normText(it.materia)}`,
    base: true,
    semestre: it.semestre,
    materia: it.materia,
    // 3 oportunidades (el usuario carga manual)
    nota1: '',
    nota2: '',
    nota3: '',
    // extras automáticas (solo si quitó 1-1-1)
    // se crean dinámicamente al necesitar
  }));
}

function mergeKeepNotas(existingRows, baseRows){
  // Mantener notas de filas existentes por (materia normalizada + semestre + base)
  const byKey = new Map();
  for (const r of existingRows || []){
    const key = `${r.base ? 'base' : 'extra'}:${Number(r.semestre)||0}:${normText(r.materia)}`;
    // Si hay duplicados, dejamos el primero (más antiguo)
    if (!byKey.has(key)) byKey.set(key, r);
  }

  const merged = [];
  // 1) Bases según malla
  for (const b of baseRows){
    const key = `base:${Number(b.semestre)||0}:${normText(b.materia)}`;
    const prev = byKey.get(key);
    if (prev){
      merged.push({
        ...b,
        nota1: prev.nota1 ?? '',
        nota2: prev.nota2 ?? '',
        nota3: prev.nota3 ?? '',
        // v4: extras si existían
        ...(hasExtraNotas(prev) ? { nota4: prev.nota4 ?? '', nota5: prev.nota5 ?? '', nota6: prev.nota6 ?? '' } : {}),
        // Optativas: nombre elegido por el alumno
        optativaNombre: prev.optativaNombre ?? '',
      });
      byKey.delete(key);
    }else{
      merged.push(b);
    }
  }
  // 2) Extras viejos que el usuario agregó (no se borran)
  for (const r of existingRows || []){
    if (!r.base) merged.push(r);
  }
  // Orden final: por semestre, base primero, luego extras
  merged.sort((a,b)=>{
    if ((a.semestre||0) !== (b.semestre||0)) return (a.semestre||0) - (b.semestre||0);
    if (a.base !== b.base) return a.base ? -1 : 1;
    return String(a.materia||'').localeCompare(String(b.materia||''));
  });
  return merged;
}

export default function NotasFinalesPage(){
  const [profile, setProfile] = useState({ carrera: '', malla: '2023', ci: '' });
  const [rows, setRows] = useState([]);
  const [totalMalla, setTotalMalla] = useState(0);

  // Cargar perfil + inicializar desde cache (Supabase via storage-adapter)
  useEffect(()=>{
    let mounted = true;
    const init = async () => {
      try {
        const p = await loadProfileAsync("");
        const carrera = String(p?.carrera || '').trim();
        const plan = (p?.malla === '2013' || p?.malla === '2023') ? p.malla : '2023';
        const ci = String(p?.ci || '').trim();
        if (mounted) setProfile({ carrera, malla: plan, ci });
      } catch (e) {
        console.error('Error loading profile for notas:', e);
      }
    };
    init();
    return () => { mounted = false; };
  },[]);

  // Cargar notas (o crearlas desde malla cache) usando storage-adapter
  useEffect(()=>{
    let mounted = true;
    const load = async () => {
      if (!profile.carrera) return;
      try{
        const ci = profile.ci || '';
        let loaded = [];
        try{
          loaded = await loadNotasAsync(ci, profile.carrera, profile.malla);
        }catch(e){
          console.error('Error loading notas from adapter:', e);
          loaded = [];
        }

        // Leer malla cache desde adapter (fallback a localStorage si no existe)
        let mallaData = null;
        try{
          mallaData = await loadMallaCacheAsync(profile.carrera, profile.malla);
        }catch(e){
          console.error('Error loading malla cache:', e);
          mallaData = null;
        }
        const mallaItems = Array.isArray(mallaData?.items) ? mallaData.items : [];
        setTotalMalla(mallaItems.length);
        const baseRows = buildBaseRows(mallaItems);

        // Migración suave desde v3 (si existía en localStorage):
        if (!loaded.length){
          try{
            const legacyKey = storageKey({ carrera: profile.carrera, plan: profile.malla, ci: profile.ci }).replace(NOTAS_PREFIX, 'fiuna_os_notas_finales_v3');
            const legacyRaw = typeof window !== 'undefined' ? localStorage.getItem(legacyKey) : null;
            const legacyParsed = safeParse(legacyRaw);
            if (Array.isArray(legacyParsed)) loaded = legacyParsed;
          }catch{ /* ignore */ }
        }

        const merged = mergeKeepNotas(loaded, baseRows);
        if (mounted) setRows(merged);
      }catch(e){
        console.error('Error initializing notas finales:', e);
      }
    };
    load();
    return ()=>{ mounted = false; };
  },[profile.carrera, profile.malla, profile.ci]);

  // Persistir (guardar en Supabase via storage-adapter si hay CI)
  useEffect(()=>{
    if (!profile.carrera) return;
    const persist = async () => {
      try{
        const ci = profile.ci || '';
        if (ci) {
          await saveNotasAsync(ci, profile.carrera, profile.malla, rows);
        } else {
          // Fallback local
          const key = storageKey({ carrera: profile.carrera, plan: profile.malla, ci: profile.ci });
          try{ localStorage.setItem(key, JSON.stringify(rows)); }catch{}
        }
      }catch(e){
        console.error('Error saving notas:', e);
      }
    };
    persist();
  },[rows, profile]);

  const semestres = useMemo(()=>{
    const s = new Set();
    for (const r of rows) if (Number(r.semestre) > 0) s.add(Number(r.semestre));
    const arr = Array.from(s).sort((a,b)=>a-b);
    // Si está vacío, mostramos 1..10 igual
    return arr.length ? arr : [1,2,3,4,5,6,7,8,9,10];
  },[rows]);

  const kpis = useMemo(()=>{
    // PROMEDIO REAL (FIUNA): cuentan TODAS las notas cargadas, no “la mejor”.
    // Si quitaste 3 unos, los 3 cuentan en el promedio.
    const todasLasNotas = [];
    const aprobadaByMateria = new Map();
    const baseSet = new Set();

    for (const r of rows){
      const matKey = normText(r.materia);
      if (!matKey) continue;
      if (r.base) baseSet.add(matKey);
      const vals = notasRowAll(r);
      for (const v of vals) todasLasNotas.push(v);
      if (vals.some((v)=> v >= 2)) aprobadaByMateria.set(matKey, true);
    }

    const promedio = todasLasNotas.length ? (todasLasNotas.reduce((a,b)=>a+b,0)/todasLasNotas.length) : 0;

    let aprobadas = 0;
    for (const k of baseSet){
      if (aprobadaByMateria.get(k)) aprobadas += 1;
    }
    const total = totalMalla || baseSet.size || 0;
    const progresoPct = total ? (aprobadas / total) * 100 : 0;

    return {
      promedio: promedio ? promedio.toFixed(2).replace('.', ',') : '0,00',
      aprobadas,
      total,
      progresoPct,
    };
  },[rows, totalMalla]);
  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

const updateRowReconcile = (id, patch) => {
  const changedKey = Object.keys(patch || {})[0]; // nota1/nota2/nota3...
  setRows((prev) => prev.map((r) => {
    if (r.id !== id) return r;

    // 1) aplica patch + lógica de extras (1-1-1)
    const next = reconcileExtras({ ...r, ...patch });

    // 2) aplica regla: solo una nota >=2 y limpia lo de la derecha
    return enforceSinglePass(next, changedKey);
  }));
};



  const maybeAutoAddExtras = (r) => {
    // Si quitó 1-1-1 en las 3 primeras oportunidades, habilitamos 3 notas extra
    return reconcileExtras(r);
  };

  const deleteRow = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const focusByData = (rowIdx, colKey) => {
    const el = document.querySelector(`[data-nf-row="${rowIdx}"][data-nf-col="${colKey}"]`);
    if (el && typeof el.focus === 'function') el.focus();
  };

  const handleEnterMove = (rowIdx, colKey) => {
    // Orden de navegación
    const cols3 = ['nota1','nota2','nota3'];
    const cols6 = ['nota1','nota2','nota3','nota4','nota5','nota6'];
    const r = rows[rowIdx];
    const useCols = hasExtraNotas(r) ? cols6 : cols3;
    const i = useCols.indexOf(colKey);
    if (i === -1) return;
    if (i < useCols.length - 1){
      focusByData(rowIdx, useCols[i+1]);
      return;
    }
    // siguiente fila
    const nextIdx = rowIdx + 1;
    if (nextIdx < rows.length) focusByData(nextIdx, 'nota1');
  };

  const addRow = (sem) => {
    const id = `extra:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    setRows((prev) => {
      const next = [...prev, { id, base: false, semestre: sem, materia: '', nota1: '', nota2: '', nota3: '' }];
      next.sort((a,b)=>{
        if ((a.semestre||0)!==(b.semestre||0)) return (a.semestre||0)-(b.semestre||0);
        if (a.base !== b.base) return a.base ? -1 : 1;
        return String(a.materia||'').localeCompare(String(b.materia||''));
      });
      return next;
    });
  };

  // Ya no hay botón de sincronización acá: la sincronización se hace desde Inicio ("Cargar Datos").

  return (
    <div className="nfWrap">
      {/* Sin barra/título extra: el encabezado global ya muestra el título de la pestaña. */}

      <Card className="nfKpiCard">
        <div className="nfKpis">
          <div className="nfKpi">
            <div className="nfKpiValue">{kpis.promedio}</div>
            <div className="nfKpiLabel">Promedio General</div>
          </div>
          <div className="nfKpi">
            <div className="nfKpiValue">{kpis.aprobadas}/{kpis.total}</div>
            <div className="nfKpiLabel">Materias Aprobadas</div>
          </div>
          <div className="nfKpi">
            <div className="nfKpiValue">{kpis.progresoPct.toFixed(2).replace('.', ',')}%</div>
            <div className="nfKpiLabel">Progreso</div>
          </div>
        </div>
        <div className="nfProgress">
          <div className="nfProgressBar" style={{ width: `${Math.min(100, Math.max(0, kpis.progresoPct))}%` }} />
        </div>
      </Card>

      {semestres.map((sem) => {
        const list = rows.filter((r) => Number(r.semestre) === sem);
        return (
          <div key={sem} className="nfSemBlock">
            <div className="nfSemHeader">{sem}ER SEMESTRE</div>

            <Card>
              <div className="nfTable nfTable3">
                <div className="nfTh">ASIGNATURA</div>
                <div className="nfTh nfThNotas">NOTAS</div>
                <div className="nfTh">ESTADO</div>

                {list.map((r) => {
                  const idx = rows.findIndex((x)=> x.id === r.id);
                  const estado = estadoFromNotas(r.nota1, r.nota2, r.nota3, r.nota4, r.nota5, r.nota6);
                  const isOptativa = normText(r.materia).startsWith('optativa');
                  return (
                    <>
                      <div className="nfTd">
                        {r.base ? (
                          <div className="nfMateriaWrap">
                            <span className="nfMateriaBase">{r.materia}</span>
                            {isOptativa && (
                              <input
                                className="nfInput nfOpt"
                                value={r.optativaNombre || ''}
                                onChange={(e)=> updateRow(r.id, { optativaNombre: e.target.value })}
                                placeholder="Nombre de tu optativa"
                              />
                            )}
                          </div>
                        ) : (
                          <div className="nfExtraRowWrap">
                            <input
                              className="nfInput"
                              value={r.materia}
                              onChange={(e) => updateRow(r.id, { materia: e.target.value })}
                              placeholder="Materia (opcional)"
                            />
                            <button
                              type="button"
                              className="nfDel"
                              onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                              title="Eliminar fila"
                              aria-label="Eliminar fila"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="nfTd nfNotasCell">
                        <div className="nfNotasGrid">
                          <input
                            className="nfInput nfNota"
                            value={r.nota1}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            onChange={(e) => updateRowReconcile(r.id, { nota1: clampNotaInput(e.target.value) })}
                            onKeyDown={(e)=>{
                              if (e.key === 'Enter'){
                                e.preventDefault();
                                handleEnterMove(idx, 'nota1');
                              }
                            }}
                            data-nf-row={idx}
                            data-nf-col="nota1"
                            placeholder="-"
                          />
                          <input
                            className="nfInput nfNota"
                            value={r.nota2}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            onChange={(e) => updateRowReconcile(r.id, { nota2: clampNotaInput(e.target.value) })}
                            onKeyDown={(e)=>{
                              if (e.key === 'Enter'){
                                e.preventDefault();
                                handleEnterMove(idx, 'nota2');
                              }
                            }}
                            data-nf-row={idx}
                            data-nf-col="nota2"
                            placeholder="-"
                          />
                          <input
                            className="nfInput nfNota"
                            value={r.nota3}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            onChange={(e) => updateRowReconcile(r.id, { nota3: clampNotaInput(e.target.value) })}
                            onKeyDown={(e)=>{
                              if (e.key === 'Enter'){
                                e.preventDefault();
                                const v3 = clampNotaInput(e.currentTarget.value);
                                setRows((prev)=> prev.map((x)=>{
                                  if (x.id !== r.id) return x;
                                  const base = { ...x, nota3: v3 };
                                  return reconcileExtras(base);
                                }));
                                const willExtra = (Number(r?.nota1)===1 && Number(r?.nota2)===1 && Number(v3)===1);
                                if (willExtra) setTimeout(()=> focusByData(idx, 'nota4'), 0);
                                else handleEnterMove(idx, 'nota3');
                              }
                            }}
                            data-nf-row={idx}
                            data-nf-col="nota3"
                            placeholder="-"
                          />
                        </div>

                        {hasExtraNotas(r) && (
                          <div className="nfNotasGrid nfNotasGridExtra">
                            <input
                              className="nfInput nfNota"
                              value={r.nota4 ?? ''}
                              inputMode="numeric"
                              pattern="[0-9]*"
onChange={(e) => {
  const v = clampNotaInput(e.target.value);
  setRows((prev)=> prev.map((x)=> {
    if (x.id !== r.id) return x;
    const next = { ...ensureExtraNotas(x), nota4: v };
    return enforceSinglePass(next, "nota4");
  }));
}}

                              onKeyDown={(e)=>{
                                if (e.key === 'Enter'){
                                  e.preventDefault();
                                  handleEnterMove(idx, 'nota4');
                                }
                              }}
                              data-nf-row={idx}
                              data-nf-col="nota4"
                              placeholder="-"
                            />
                            <input
                              className="nfInput nfNota"
                              value={r.nota5 ?? ''}
                              inputMode="numeric"
                              pattern="[0-9]*"
                             onChange={(e) => {
  const v = clampNotaInput(e.target.value);
  setRows((prev)=> prev.map((x)=> {
    if (x.id !== r.id) return x;
    const next = { ...ensureExtraNotas(x), nota5: v };
    return enforceSinglePass(next, "nota5");
  }));
}}

                              onKeyDown={(e)=>{
                                if (e.key === 'Enter'){
                                  e.preventDefault();
                                  handleEnterMove(idx, 'nota5');
                                }
                              }}
                              data-nf-row={idx}
                              data-nf-col="nota5"
                              placeholder="-"
                            />
                            <input
                              className="nfInput nfNota"
                              value={r.nota6 ?? ''}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              onChange={(e) => {
  const v = clampNotaInput(e.target.value);
  setRows((prev)=> prev.map((x)=> {
    if (x.id !== r.id) return x;
    const next = { ...ensureExtraNotas(x), nota6: v };
    return enforceSinglePass(next, "nota6");
  }));
}}

                              onKeyDown={(e)=>{
                                if (e.key === 'Enter'){
                                  e.preventDefault();
                                  handleEnterMove(idx, 'nota6');
                                }
                              }}
                              data-nf-row={idx}
                              data-nf-col="nota6"
                              placeholder="-"
                            />
                          </div>
                        )}
                      </div>

                      <div className="nfTd">
                        <div className={"nfEstado " + (estado === 'APROBADO' ? 'ok' : estado === 'AUN NO' ? 'bad' : 'pend')}>
                          {estado}
                        </div>
                      </div>
                    </>
                  );
                })}
              </div>

              <div className="nfAddRow">
                <button type="button" className="btnSoft" onClick={() => addRow(sem)}>➕ Agregar fila</button>
              </div>
            </Card>
          </div>
        );
      })}
      <style jsx>{`
        .nfKpiCard{ padding: 14px; }
        .nfKpis{ display:grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .nfKpi{ text-align: center; padding: 10px; border: 1px solid var(--border); border-radius: 14px; background: rgba(255,255,255,0.9); }
        .nfKpiValue{ font-size: 26px; font-weight: 900; color: var(--primary); }
        .nfKpiLabel{ font-size: 12px; font-weight: 800; color: rgba(15,23,42,0.7); margin-top: 4px; }
        .nfProgress{ margin-top: 10px; height: 10px; border-radius: 999px; background: rgba(148,163,184,0.25); overflow:hidden; }
        .nfProgressBar{ height: 100%; border-radius: 999px; background: linear-gradient(90deg, rgba(0,176,255,0.35), rgba(0,176,255,0.95)); }

        .nfSemBlock{ margin-top: 14px; }
        .nfSemHeader{ font-weight: 950; color: var(--primary); letter-spacing: .02em; margin: 8px 0 8px; }

        .nfTable{
          display: grid;
          grid-template-columns: minmax(240px, 1.4fr) minmax(220px, 1fr) 140px;
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
        }
        .nfTh{
          background: rgba(0,176,255,0.95);
          color: white;
          font-weight: 900;
          font-size: 12px;
          padding: 10px 10px;
          border-right: 1px solid rgba(255,255,255,0.15);
        }
        .nfThNotas{ text-align:center; }
        .nfTd{ padding: 10px; border-top: 1px solid var(--border); border-right: 1px solid var(--border); background: white; }
        .nfNotasCell{ padding: 10px; }
        .nfNotasGrid{ display:grid; grid-template-columns: repeat(3, minmax(44px, 1fr)); gap: 8px; }
        .nfNotasGridExtra{ margin-top: 8px; }
        .nfMateriaBase{ font-weight: 800; color: rgba(15,23,42,0.9); }
        .nfMateriaWrap{ display:flex; gap: 10px; align-items:center; flex-wrap: wrap; }
        .nfExtraRowWrap{ display:flex; gap: 10px; align-items:center; }
        .nfDel{ border: 1px solid var(--border); background: white; border-radius: 12px; padding: 8px 10px; font-weight: 950; cursor: pointer; line-height: 1; }
        .nfDel:active{ transform: translateY(1px); }
        .nfOpt{ max-width: 320px; font-weight: 800; }
        .nfInput{ width: 100%; border: 1px solid var(--border); border-radius: 12px; padding: 8px 10px; font-weight: 800; background: rgba(255,255,255,0.92); }
        .nfNota{ text-align: center; }
        .nfEstado{ display:inline-flex; align-items:center; justify-content:center; width: 100%; padding: 8px 10px; border-radius: 12px; font-weight: 950; font-size: 12px; }
        .nfEstado.ok{ background: rgba(34,197,94,0.18); color: rgba(21,128,61,1); }
        .nfEstado.bad{ background: rgba(239,68,68,0.16); color: rgba(185,28,28,1); }
        .nfEstado.pend{ background: rgba(148,163,184,0.2); color: rgba(51,65,85,1); }
        .nfAddRow{ padding: 12px; display:flex; justify-content:flex-end; }

        /* Móvil: apretamos columnas de notas */
        @media (max-width: 520px){
          .nfKpiValue{ font-size: 22px; }
          .nfTable{ grid-template-columns: 1fr 1fr 110px; }
          .nfNotasGrid{ grid-template-columns: repeat(3, minmax(36px, 1fr)); gap: 6px; }
          .nfTh{ font-size: 11px; padding: 9px 8px; }
          .nfTd{ padding: 8px; }
          .nfInput{ padding: 7px 8px; }
          .nfMateriaWrap{ flex-direction: column; align-items:flex-start; }
          .nfExtraRowWrap{ gap: 8px; }
          .nfDel{ padding: 7px 9px; }
          .nfOpt{ max-width: 100%; }
        }
      `}</style>
    </div>
  );
}
