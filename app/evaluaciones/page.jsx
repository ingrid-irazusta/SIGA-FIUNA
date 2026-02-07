"use client";

import React, { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card";
import { loadEvaluationsAsync, saveEvaluationsAsync, loadCurrentCoursesAsync, loadProfileAsync } from "../../lib/storage-adapter";

const CURRENT_COURSES_KEY = "fiuna_os_current_courses_v1";
const EVAL_KEY = "fiuna_os_evaluaciones_v1";
const EVAL_EDITOR_OPEN_KEY = "fiuna_os_evaluaciones_editor_open_v1";

const TYPES = [
  { key: "p1", label: "1er Parcial" },
  { key: "p2", label: "2do Parcial" },
  { key: "f1", label: "Final 1" },
  { key: "f2", label: "Final 2" },
  { key: "f3", label: "Final 3" },
];

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateTime(dateYMD, timeHM) {
  if (!dateYMD) return null;
  // Interpretamos como local.
  const t = (timeHM || "00:00").trim();
  const iso = `${dateYMD}T${t}:00`;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatDMY(dateYMD) {
  if (!dateYMD) return "";
  const [y, m, d] = dateYMD.split("-");
  if (!y || !m || !d) return dateYMD;
  return `${d}/${m}/${y}`;
}

function capFirst(s) {
  const str = String(s || "");
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Formato largo, ejemplo: "Lunes 27 de febrero del 2026"
function formatLongES(dateYMD) {
  if (!dateYMD) return "";
  const dt = parseDateTime(dateYMD, "00:00");
  if (!dt) return dateYMD;

  const weekday = dt.toLocaleDateString("es-ES", { weekday: "long" });
  const day = dt.getDate();
  const month = dt.toLocaleDateString("es-ES", { month: "long" });
  const year = dt.getFullYear();

  return `${capFirst(weekday)} ${day} de ${month} del ${year}`;
}

function daysDiffFromToday(dt) {
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

async function buildFromInicioCourses(ci) {
  try {
    const arr = await loadCurrentCoursesAsync(ci);
    const list = Array.isArray(arr) ? arr : [];
    // list items: {semestre/sem, nombre/mat, firma}
    return list
      .map((x) => String(x?.nombre || x?.mat || "").trim())
      .filter(Boolean)
      .map((materia) => ({
        materia,
        p1: { fecha: "", hora: "" },
        p2: { fecha: "", hora: "" },
        f1: { fecha: "", hora: "" },
        f2: { fecha: "", hora: "" },
        f3: { fecha: "", hora: "" },
      }));
  } catch (e) {
    return [];
  }
}


export default function EvaluacionesPage() {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // UI state
  const [openMateria, setOpenMateria] = useState(null);
  const [showFinal3, setShowFinal3] = useState({}); // { [materia]: boolean }
  // Toggle global del editor (para no ocupar espacio cuando solo querés ver el cronograma)
  const [showEditor, setShowEditor] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false); // evita doble click / doble pestaña


  // Para evitar hydration mismatch: calculamos "hoy" solo en cliente.
  const [clientNow, setClientNow] = useState(null);

  useEffect(() => {
    setClientNow(new Date());
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        setLoaded(false);
        const profile = await loadProfileAsync("");
        const ci = profile?.ci || "";
        if (mounted) setProfileCI(ci);

        // Estado del toggle global del editor (seguimos guardando en localStorage para este toggle)
        const rawToggle = typeof window !== 'undefined' ? localStorage.getItem(EVAL_EDITOR_OPEN_KEY) : null;
        const hasToggle = rawToggle !== null;
        const toggleVal = rawToggle === "1";

        let saved = [];
        if (ci) saved = await loadEvaluationsAsync(ci);

        if (Array.isArray(saved) && saved.length) {
          if (mounted) setRows(saved);
          if (!hasToggle) {
            const any = saved.some((r) =>
              TYPES.some((t) => {
                const c = r?.[t.key];
                return Boolean((c?.fecha || "").trim() || (c?.hora || "").trim());
              })
            );
            if (mounted) setShowEditor(!any);
          } else {
            if (mounted) setShowEditor(toggleVal);
          }
        } else {
          const fromInicio = await buildFromInicioCourses(ci);
          if (mounted) setRows(fromInicio);
          if (!hasToggle) {
            if (mounted) setShowEditor(true);
          } else if (mounted) setShowEditor(toggleVal);
        }
      } catch (e) {
        console.error('Error initializing evaluations:', e);
        const fromInicio = await buildFromInicioCourses("");
        if (mounted) setRows(fromInicio);
        if (mounted) setShowEditor(true);
      } finally {
        if (mounted) setLoaded(true);
      }
    };

    init();

    return () => { mounted = false; };
  }, []);

  // Mantener materias alineadas con Inicio (sin borrar lo ya cargado):
  // - Si se agregan materias en Inicio, aparecen acá.
  // - Si se eliminan materias en Inicio, acá se eliminan también.
  useEffect(() => {
    if (!loaded) return;

    const syncFromInicio = () => {
      const fromInicio = buildFromInicioCourses();
      setRows((prev) => {
        // Si por algún motivo Inicio todavía no está disponible (lectura vacía),
        // NO pisamos lo ya cargado (evita que “desaparezca” al cambiar de pestaña).
        if (Array.isArray(prev) && prev.length > 0 && fromInicio.length === 0) return prev;
        // Mapa por materia
        const prevMap = new Map(prev.map((r) => [r.materia, r]));
        const next = fromInicio.map((base) => {
          const old = prevMap.get(base.materia);
          return old ? { ...base, ...old, materia: base.materia } : base;
        });
        return next;
      });
    };

    // Escuchamos un evento si lo disparan desde Inicio; si no existe, igual hacemos sync al foco.
    const onFocus = () => syncFromInicio();
    const onCoursesUpdated = () => syncFromInicio();

    window.addEventListener("focus", onFocus);
    window.addEventListener("fiuna_current_courses_updated", onCoursesUpdated);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("fiuna_current_courses_updated", onCoursesUpdated);
    };
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    const persist = async () => {
      try {
        if (profileCI) {
          await saveEvaluationsAsync(profileCI, rows);
        } else {
          try { localStorage.setItem(EVAL_KEY, JSON.stringify(rows)); } catch {}
        }
        try { window.dispatchEvent(new Event("fiuna_evaluaciones_updated")); } catch {}
      } catch (e) {
        console.error('Error saving evaluations:', e);
      }
    };
    persist();
  }, [rows, loaded]);

  // Persistimos el toggle global del editor
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(EVAL_EDITOR_OPEN_KEY, showEditor ? "1" : "0");
    } catch {
      // ignore
    }
  }, [showEditor, loaded]);

  const setCell = (materia, typeKey, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.materia !== materia) return r;
        const cur = r?.[typeKey] || { fecha: "", hora: "" };
        return { ...r, [typeKey]: { ...cur, [field]: value } };
      })
    );
  };

  const toggleOpen = (materia) => {
    setOpenMateria((cur) => (cur === materia ? null : materia));
  };

  const materiaHasAnyData = (r) => {
    return TYPES.some((t) => {
      const c = r?.[t.key];
      return Boolean((c?.fecha || "").trim() || (c?.hora || "").trim());
    });
  };

  const lists = useMemo(() => {
    const out = {};
    for (const t of TYPES) {
      const items = [];
      rows.forEach((r) => {
        const cell = r?.[t.key];
        const fecha = (cell?.fecha || "").trim();
        const hora = (cell?.hora || "").trim();
        const dt = parseDateTime(fecha, hora);
        if (!dt) return;

        let estado = "—";
        let dias = null;
        if (clientNow) {
          dias = Math.floor((dt.getTime() - clientNow.getTime()) / (1000 * 60 * 60 * 24));
          if (dias === 0) estado = "🟡 Hoy";
          else if (dias === 1) estado = "🟠 Mañana";
          else if (dias < 0) estado = "✅ Finalizado";
          else estado = `${dias} días`;
        }

        items.push({
          materia: r.materia,
          fecha,
          hora,
          dt,
          dias,
          estado,
        });
      });
      items.sort((a, b) => a.dt.getTime() - b.dt.getTime());
      out[t.key] = items;
    }
    return out;
  }, [rows, clientNow]);

  const titleFor = (key) => {
    const found = TYPES.find((t) => t.key === key);
    return found ? found.label : key;
  };


  const hasAnyExam = useMemo(() => {
    try {
      return Object.values(lists).some((arr) => Array.isArray(arr) && arr.length > 0);
    } catch {
      return false;
    }
  }, [lists]);

  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

const downloadPdf = () => {
  // Evita doble click (doble acción)
  if (pdfBusy) return;
  if (!hasAnyExam) return;

  setPdfBusy(true);
  setTimeout(() => setPdfBusy(false), 900);

  const sections = TYPES
    .map((t) => ({
      key: t.key,
      title: titleFor(t.key),
      items: lists[t.key] || [],
    }))
    .filter((s) => Array.isArray(s.items) && s.items.length);

  const now = new Date();
  const stamp = now.toLocaleString("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const body = sections
    .map((sec) => {
      const rowsHtml = sec.items
        .map((it) => {
          const materia = escapeHtml(it.materia);
          const fecha = escapeHtml(formatLongES(it.fecha) || "—");
          const hora = escapeHtml(it.hora || "—");
          return `
            <tr>
              <td class="m">${materia}</td>
              <td class="f">${fecha}</td>
              <td class="h">${hora}</td>
            </tr>`;
        })
        .join("");

      return `
        <div class="sec">
          <div class="secTitle">${escapeHtml(String(sec.title).toUpperCase())}</div>
          <table>
            <thead>
              <tr>
                <th>Materia</th>
                <th>Fecha</th>
                <th>Hora</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>`;
    })
    .join("");

  // Sin encabezado grande ni pie: solo "Generado... SIGA FIUNA"
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Horario de exámenes</title>
  <style>
    *{ box-sizing:border-box; }
    body{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; color:#0f172a; }
    .meta{ font-size:12px; color:#64748b; text-align:right; white-space:nowrap; margin-bottom: 10px; }

    .sec{ margin-top:14px; page-break-inside: avoid; }
    .secTitle{
      font-size:12px; font-weight:900; letter-spacing:.6px; text-align:center;
      padding:10px 12px; background: rgba(14,165,233,0.90); color:#fff; border-radius:12px;
    }

    table{ width:100%; border-collapse:collapse; margin-top:10px; }
    th, td{ border-bottom:1px solid rgba(15,23,42,0.10); padding:10px 10px; font-size:12px; vertical-align:top; }
    th{ background: rgba(14,165,233,0.12); text-transform:uppercase; letter-spacing:.5px; font-weight:900; }
    td.m{ font-weight:900; width:38%; }
    td.f{ width:44%; }
    td.h{ width:18%; white-space:nowrap; }

    /* Botón manual (PC y móvil) */
    .printBtn{
      border:1px solid rgba(15,23,42,0.15);
      background: rgba(14,165,233,0.12);
      padding:10px 12px;
      border-radius:12px;
      font-weight:900;
      cursor:pointer;
      margin-bottom:12px;
    }
    @media print{
      .printBtn{ display:none; }
      body{ margin: 14mm; }
      .secTitle{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      th{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <button class="printBtn" onclick="window.print()">Guardar como PDF</button>

  <div class="meta">Generado: ${escapeHtml(stamp)}<br/>SIGA FIUNA</div>

  ${body}
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  // ✅ IMPORTANTÍSIMO: abrir EN LA MISMA pestaña (no popup, no doble pestaña)
  window.location.assign(url);

  // Nota: no revocamos inmediatamente porque si no, algunos navegadores cargan en blanco.
  // El navegador liberará cuando ya no use el blob; si querés revocar, hacelo desde la página generada.
};


  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card
        title={<span className="sectionLabel">🧾 HORARIO DE EXÁMENES</span>}
        className={!showEditor ? "cardCompact" : ""}
        right={
          rows.length ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
             <button
  className="btn btnSoft"
  onClick={downloadPdf}
  title="Descargar / Guardar como PDF"
  disabled={!hasAnyExam || pdfBusy}
  style={!hasAnyExam || pdfBusy ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
>
  {pdfBusy ? "Generando..." : "⬇ PDF"}
</button>

              <button
                className="btn btnSoft"
                onClick={() => setShowEditor((v) => !v)}
                title={showEditor ? "Ocultar editor" : "Editar cronograma"}
              >
                {showEditor ? "▾ Ocultar editor" : "▸ Editar cronograma"}
              </button>
            </div>
          ) : null
        }
      >
        {rows.length === 0 ? (
          <div className="muted" style={{ padding: 10 }}>
            No hay materias. Agregá materias en Inicio → “Materias en curso”.
          </div>
        ) : showEditor ? (
          <div className="examEditorList">
            {rows.map((r) => {
              const isOpen = openMateria === r.materia;
              const hasData = materiaHasAnyData(r);
              const showF3 = Boolean(showFinal3[r.materia] || (r?.f3?.fecha || "").trim() || (r?.f3?.hora || "").trim());

              return (
                <div key={r.materia} className="examMateriaCard">
                  <div className="examMateriaHeader">
                    <div className="examMateriaName">{r.materia}</div>

                    <div className="examMateriaActions">
                      <button
                        className="btn btnSoft"
                        onClick={() => toggleOpen(r.materia)}
                        title={isOpen ? "Ocultar" : "Mostrar"}
                      >
                        {isOpen ? "▾ Ocultar" : "▸ Añadir horario de examen"}
                      </button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="examEditorBody">
                      <div className="examInputsGrid">
                        {["p1", "p2", "f1", "f2"].map((k) => (
                          <div key={k} className="examRow">
                            <div className="examType">{titleFor(k)}</div>

                            <div className="examField">
                              <span className="examLabel">FECHA:</span>
                              <input
                                className="examInput"
                                type="date"
                                value={r?.[k]?.fecha || ""}
                                onChange={(e) => setCell(r.materia, k, "fecha", e.target.value)}
                              />
                            </div>

                            <div className="examField">
                              <span className="examLabel">HORA:</span>
                              <input
                                className="examInput"
                                type="time"
                                value={r?.[k]?.hora || ""}
                                onChange={(e) => setCell(r.materia, k, "hora", e.target.value)}
                              />
                            </div>
                          </div>
                        ))}

                        {showF3 ? (
                          <div className="examRow">
                            <div className="examType">{titleFor("f3")}</div>

                            <div className="examField">
                              <span className="examLabel">FECHA:</span>
                              <input
                                className="examInput"
                                type="date"
                                value={r?.f3?.fecha || ""}
                                onChange={(e) => setCell(r.materia, "f3", "fecha", e.target.value)}
                              />
                            </div>

                            <div className="examField">
                              <span className="examLabel">HORA:</span>
                              <input
                                className="examInput"
                                type="time"
                                value={r?.f3?.hora || ""}
                                onChange={(e) => setCell(r.materia, "f3", "hora", e.target.value)}
                              />
                            </div>

                            <div className="examField examRowRight">
                              <button
                                className="btn btnGhost"
                                onClick={() => {
                                  // Si no hay nada cargado, lo ocultamos
                                  const f = (r?.f3?.fecha || "").trim();
                                  const h = (r?.f3?.hora || "").trim();
                                  if (!f && !h) {
                                    setShowFinal3((prev) => ({ ...prev, [r.materia]: false }));
                                  }
                                }}
                                title="Ocultar Final 3 (solo si está vacío)"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="examFinal3Add">
                            <button
                              className="btn btnGhost"
                              onClick={() => setShowFinal3((prev) => ({ ...prev, [r.materia]: true }))}
                            >
                              ➕ Agregar Final 3 (solo si existe)
                            </button>
                          </div>
                        )}
                      </div>

                      {hasData ? (
                        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                          Tip: si ya completaste, podés tocar <b>“Ocultar”</b> y queda guardado.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </Card>

      {Object.values(lists).some((arr) => arr.length > 0) ? (
        <div className="grid" style={{ gap: 14 }}>
          {TYPES.map((t) => {
            const items = lists[t.key] || [];
            if (!items.length) return null;

            return (
              <div key={t.key} className="examSummaryCard">
                <div className="examSummaryTitle">{titleFor(t.key).toUpperCase()}</div>

                <div className="examSummaryWrap">
                  <div className="examSummaryTable">
                    <div className="examSummaryTh">📚 MATERIA</div>
                    <div className="examSummaryTh">📅 FECHA</div>
                    <div className="examSummaryTh">⏰ HORA</div>
                    <div className="examSummaryTh">🗓️ DÍAS RESTANTES</div>

                    {items.map((it) => (
                      <React.Fragment key={`${t.key}-${it.materia}-${it.fecha}-${it.hora}`}>
                        <div className="examSummaryTd examSummaryMateria">{it.materia}</div>
                        <div className="examSummaryTd">{formatLongES(it.fecha) || "—"}</div>
                        <div className="examSummaryTd">{it.hora || "—"}</div>
                        <div className="examSummaryTd">{it.estado}</div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
