export function normText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRequisitos(reqArr) {
  // Soporta:
  // - array (ideal)
  // - string "A, B, C" o con saltos de línea
  if (Array.isArray(reqArr)) {
    return reqArr
      .map((r) => String(r || "").trim())
      .filter(Boolean);
  }
  if (typeof reqArr === "string") {
    return reqArr
      .split(/[\n;]+|,(?![^\[]*\])/g)
      .map((r) => String(r || "").trim())
      .filter(Boolean);
  }
  return [];
}

export function isPlaceholderReq(reqNorm) {
  // Placeholders informativos (no deberían bloquear por defecto)
  // Ej: "SEGUN REGLAMENTO", "SEGUN OPTATIVA"
  return reqNorm.startsWith("SEGUN ") || reqNorm === "SEGUN REGLAMENTO" || reqNorm === "SEGUN OPTATIVA";
}

export function calcEstados({ items, aprobadasSet, strictMode, blockPlaceholders, radarTargetKey, flashKeys }) {
  // items: array con { key, materia, semestre, requisitosKeys: [] }
  const estados = new Map();
  for (const it of items) {
    const isOk = aprobadasSet.has(it.key);
    if (isOk) {
      estados.set(it.key, "aprobada");
      continue;
    }

    // En flexible, nunca bloquea, pero igual calculamos guia (azul/gris)
    const missing = [];
    for (const rk of it.requisitosKeys) {
      if (!blockPlaceholders && isPlaceholderReq(rk)) continue;
      if (!aprobadasSet.has(rk)) missing.push(rk);
    }

    estados.set(it.key, missing.length === 0 ? "habilitada" : "bloqueada");
  }

  // Overlays (amarillo) se manejan en el render: radar y flash
  return estados;
}
