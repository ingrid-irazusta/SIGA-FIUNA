// API privada (server-side) para leer la BD_Malla vía tu Web App de Apps Script.
// - Mantiene el link del script fuera del frontend (no es una clave, pero igual lo dejamos en backend).
// - Cachea 60s en memoria para que muchos usuarios cuenten como 1 request real por minuto.

export const runtime = "nodejs";

const CACHE_TTL_MS = 60_000;
let cache = {
  ts: 0,
  dataByKey: new Map(),
};

function getBaseUrl() {
  // Preferimos variable de entorno para que puedas cambiarlo sin tocar código.
  // (En local: .env.local)
  return (
    process.env.MALLA_APPS_SCRIPT_URL ||
    "https://script.google.com/macros/s/AKfycbxq_I1OqRrjHRqeDHe27RqmvCIUYTYDi7vgOzFLFVbAq_MdjMGPWTvjykZXJaDdglZHDw/exec"
  );
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const carrera = (searchParams.get("carrera") || "").trim();
    const plan = (searchParams.get("plan") || "").trim();

    if (!carrera || !plan) {
      return json({ ok: false, error: "Faltan parámetros: carrera y plan" }, 400);
    }

    const key = `${carrera}||${plan}`;
    const now = Date.now();

    // Limpieza simple del cache si expiró
    if (now - cache.ts > CACHE_TTL_MS) {
      cache.ts = now;
      cache.dataByKey = new Map();
    }

    if (cache.dataByKey.has(key)) {
      return json({ ok: true, cached: true, ...cache.dataByKey.get(key) });
    }

    const base = getBaseUrl();
    const token = process.env.MALLA_TOKEN || "";
    const url = `${base}?carrera=${encodeURIComponent(carrera)}&plan=${encodeURIComponent(plan)}${token ? `&token=${encodeURIComponent(token)}` : ""}`;

    const r = await fetch(url, { method: "GET" });
    const text = await r.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // A veces Apps Script devuelve HTML si hay problemas de permisos.
      return json(
        {
          ok: false,
          error: "Respuesta no válida desde Apps Script (no es JSON)",
          debug: text.slice(0, 200),
        },
        502
      );
    }

    if (!r.ok || data?.ok === false) {
      return json(
        {
          ok: false,
          error: data?.error || "No se pudo leer la BD_Malla",
          debug: data,
        },
        502
      );
    }

    const payload = {
      carrera: data.carrera || carrera,
      plan: String(data.plan || plan),
      materias: Array.isArray(data.materias) ? data.materias : [],
    };

    cache.dataByKey.set(key, payload);
    return json({ ok: true, cached: false, ...payload });
  } catch (e) {
    return json({ ok: false, error: e?.message || "Error inesperado" }, 500);
  }
}
