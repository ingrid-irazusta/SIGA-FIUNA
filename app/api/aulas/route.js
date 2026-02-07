export const dynamic = "force-dynamic";

// CSV publico de TU Google Sheets (BD intermedia). Si hay una sola hoja, gid=0.
// (La hoja debe estar compartida como "Cualquier persona con el enlace" en modo lector.)
const SHEET_CSV =
  "https://docs.google.com/spreadsheets/d/1vkHJBV4c46_JWM2uiEdeiltHH9RN0VLhaSGPU6udYP4/export?format=csv&gid=0";

// Cache en memoria para evitar pegarle al CSV mas de 1 vez por minuto.
let _cache = {
  ts: 0,
  rows: null,
  cols: null,
  dataRows: null,
};

// --- helpers ---
function stripDiacritics(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function romanToArabicTokens(s) {
  // Convierte tokens romanos comunes (I..X) cuando aparecen como palabra suelta.
  const map = {
    "X": "10",
    "IX": "9",
    "VIII": "8",
    "VII": "7",
    "VI": "6",
    "V": "5",
    "IV": "4",
    "III": "3",
    "II": "2",
    "I": "1",
  };
  return s.replace(/\b(X|IX|VIII|VII|VI|V|IV|III|II|I)\b/g, (m) => map[m] || m);
}

function normalizeText(s) {
  return romanToArabicTokens(stripDiacritics(String(s)))
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normTime(s) {
  // Normaliza a "HH:MM". Acepta 8:00, 08.00, 08:00 hs, etc.
  const m = String(s || "").match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return "";
  const hh = m[1].padStart(2, "0");
  return `${hh}:${m[2]}`;
}


function parseCSV(text) {
  // Parser CSV simple con comillas (suficiente para Google export)
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      cur = "";
      // evita filas vacías finales
      if (row.some((c) => String(c).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }
  row.push(cur);
  if (row.some((c) => String(c).trim() !== "")) rows.push(row);
  return rows;
}

function pickCols(headerRow) {
  // Si hay headers, intentamos mapear; si no, usamos índices por letra.
  const h = headerRow.map((x) => normalizeText(x));
  const find = (...keys) => {
    for (const k of keys) {
      const idx = h.findIndex((x) => x.includes(k));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  // Heurística: si hay texto no numérico, probablemente hay encabezados.
  const hasHeaders = h.some((x) => x.length > 0 && !/^\d+$/.test(x));

  // Fallback fijo por letras (D,E,F,H,I,J,L,M) cuando no hay headers o no se pudieron detectar.
  const fallback = {
    hasHeaders: false,
    materia: 3,
    seccion: 4,
    tipo: 5,
    obs: 7,
    reemplazo: 8,
    horaInicio: 9,
    aula: 11,
    estado: 12,
    profTitular: -1,
  };

  if (!hasHeaders) return fallback;

  const mapped = {
    hasHeaders: true,
    materia: find("ASIGNATURA", "MATERIA", "NOMBRE"),
    seccion: find("SECCION", "SECCIÓN"),
    tipo: find("TIPO", "T/P", "TP"),
    obs: find("OBSERVACION", "OBS"),
    reemplazo: find("REEMPLAZ", "SUPL", "SUPLENTE"),
    horaInicio: find("HORA INICIO", "INICIO"),
    aula: find("AULA"),
    estado: find("ESTADO", "ASIST"),
    profTitular: find("PROF", "DOCENTE"),
  };

  // Si no encontramos columnas críticas, no arriesgamos: usamos fallback por letra.
  const critical = [mapped.materia, mapped.seccion, mapped.tipo, mapped.aula, mapped.estado];
  if (critical.some((i) => i < 0)) return fallback;

  return mapped;
}


function normalizeTipo(val) {
  const t = normalizeText(val || "");
  if (!t) return "";
  if (t === "T" || t.startsWith("TEO") || t.startsWith("TEO")) return "T";
  if (t === "P" || t.startsWith("PRA") || t.startsWith("PRAC")) return "P";
  // fallback: primera letra
  return t[0];
}

function tipoMatches(qTipo, rowTipo) {
  const qt = normalizeTipo(qTipo);
  const rt = normalizeTipo(rowTipo);
  return qt && rt && qt === rt;
}

function minutesFromTime(t) {
  const nt = normTime(t);
  if (!nt) return null;
  const [h, m] = nt.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function pickBestByTime(cands, qHora, cols) {
  if (!cands.length) return null;
  const qMin = minutesFromTime(qHora);
  if (qMin === null) return cands.find((c) => String(c.r[cols.aula] || "").trim()) || cands[0];

  let best = null;
  for (const c of cands) {
    const rMin = minutesFromTime(c.r[cols.horaInicio]);
    const diff = rMin === null ? 10**9 : Math.abs(rMin - qMin);
    const aula = String(c.r[cols.aula] || "").trim();
    const score = (diff * 1000) + (aula ? 0 : 1); // menor diff gana; preferimos que tenga aula
    if (!best || score < best.score) best = { c, score };
  }
  return best ? best.c : cands[0];
}

function decodeEstado(code) {
  const c = normalizeText(code || "");
  if (!c) return { icon: "⏳", text: "Aún no llegó", code: "" };
  if (c === "P") return { icon: "✅", text: "Presente", code: "P" };
  if (c === "A") return { icon: "❌", text: "Ausente", code: "A" };
  if (c === "AA") return { icon: "⚠️", text: "Ausente c/ Aviso", code: "AA" };
  if (c === "R") return { icon: "🔄", text: "Reemplazo", code: "R" };
  if (c === "T") return { icon: "ℹ️", text: "Tutoría", code: "T" };
  if (c === "REC") return { icon: "📅", text: "Recuperación", code: "REC" };
  return { icon: "ℹ️", text: c, code: c };
}

async function getSheetDataCached() {
  const now = Date.now();
  const TTL = 60 * 1000;

  if (_cache.dataRows && now - _cache.ts < TTL) {
    return { ..._cache, fromCache: true, ttlMs: Math.max(0, TTL - (now - _cache.ts)) };
  }

  const res = await fetch(SHEET_CSV, {
    cache: "no-store",
    headers: {
      // Fuerza salida texto/CSV (a veces Google devuelve HTML si no es público)
      "Accept": "text/csv,text/plain,*/*",
    },
  });
  const csv = await res.text();

  if (!res.ok) {
    const err = new Error(`No se pudo leer el CSV de aulas (HTTP ${res.status})`);
    // @ts-ignore
    err.status = 502;
    throw err;
  }

  // Diagnóstico: si la hoja no es pública, Google suele devolver HTML de login/permiso.
  const firstChunk = (csv || "").slice(0, 300).toLowerCase();
  if (firstChunk.includes("<html") || firstChunk.includes("accounts.google") || firstChunk.includes("signin")) {
    const err = new Error(
      "El enlace no está devolviendo CSV (parece HTML de login/permisos). " +
      "Revisá: Compartir → 'Cualquier persona con el enlace' → Lector."
    );
    // @ts-ignore
    err.status = 502;
    // @ts-ignore
    err.debug = "HTML_en_respuesta";
    throw err;
  }
  const rows = parseCSV(csv);
  if (!rows.length) {
    const err = new Error("CSV vacío");
    // @ts-ignore
    err.status = 502;
    throw err;
  }

  // Chequeo básico de columnas esperadas (D..M => al menos 13 columnas)
  const maxCols = Math.max(...rows.map((r) => r.length));
  if (maxCols < 13) {
    const err = new Error(
      `El CSV no tiene suficientes columnas (tiene ${maxCols}). ` +
      "Se espera una tabla estilo BD_Aulas con columnas hasta la M (D,E,F,H,I,J,L,M)."
    );
    // @ts-ignore
    err.status = 502;
    // @ts-ignore
    err.debug = `cols=${maxCols}`;
    throw err;
  }

  const cols = pickCols(rows[0]);
  const dataRows = cols.hasHeaders ? rows.slice(1) : rows;

  _cache = { ts: now, rows, cols, dataRows };
  return { ..._cache, fromCache: false, ttlMs: TTL };
}

function buildQuery(body) {
  return {
    materia: normalizeText(body?.materia || ""),
    seccion: normalizeText(body?.seccion || ""),
    tipo: normalizeText(body?.tipo || ""), // "T" | "P" (o TEO/PRAC)
    horaInicio: normTime(body?.horaInicio || ""),
  };
}

function matchOne(q, dataRows, cols) {
  if (!q?.materia) return { ok: false, found: false, error: "Falta materia" };
  if (!q?.tipo) return { ok: false, found: false, error: "Falta tipo" };
  if (!q?.seccion) return { ok: false, found: false, error: "Falta seccion" };

  // Regla mínima (estricta): Materia + Tipo (T/P) + Sección
  const cands = [];
  for (const r of dataRows) {
    const mat = normalizeText(r[cols.materia] || "");
    const sec = normalizeText(r[cols.seccion] || "");
    const tipo = normalizeTipo(r[cols.tipo] || "");

    if (!mat) continue;
    if (mat !== q.materia) continue;
    if (sec !== q.seccion) continue;
    if (!tipoMatches(q.tipo, tipo)) continue;

    cands.push({ r });
  }

  if (!cands.length) return { ok: true, found: false };

  // Si hay varios candidatos, desempata por hora (más cercana/igual) y preferimos que tenga aula.
  const best = pickBestByTime(cands, q.horaInicio, cols) || cands[0];
  const r = best.r;

  const estadoInfo = decodeEstado(r[cols.estado] || "");
  const reemplazo = cols.reemplazo >= 0 ? String(r[cols.reemplazo] || "").trim() : "";
  const obs = cols.obs >= 0 ? String(r[cols.obs] || "").trim() : "";
  const aula = String(r[cols.aula] || "").trim();

  return {
    ok: true,
    found: true,
    aula: aula || "No hallada",
    estado: estadoInfo,
    reemplazo: reemplazo || "",
    observacion: obs || "",
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { dataRows, cols, fromCache, ttlMs } = await getSheetDataCached();

    // Batch mode: { classes: [...] }
    if (Array.isArray(body?.classes)) {
      const results = {};
      for (const item of body.classes) {
        const q = buildQuery(item);
        const key = String(item?.key || "");
        const res = matchOne(q, dataRows, cols);
        if (key) results[key] = res;
      }
      return Response.json({ ok: true, fromCache, cooldownMs: ttlMs, results });
    }

    // Single mode
    const q = buildQuery(body);
    if (!q.materia) return Response.json({ ok: false, error: "Falta materia" }, { status: 400 });
    const one = matchOne(q, dataRows, cols);
    return Response.json({ ...one, fromCache, cooldownMs: ttlMs });
  } catch (e) {
    const status = e?.status || 500;
    return Response.json({ ok: false, error: e?.message || "Error", debug: e?.debug || "" }, { status });
  }
}
