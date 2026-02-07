export const mockAgendaHoy = [
  { inicio: "08:00", fin: "10:00", materia: "Cálculo II", tipo: "TEO", profesor: "Docente", aula: "A-12", estado: "✅ Presente" },
  { inicio: "10:00", fin: "12:00", materia: "Física II", tipo: "PRAC", profesor: "Docente", aula: "Lab 3", estado: "⏳ Aún no llegó" },
  { inicio: "14:00", fin: "16:00", materia: "Programación", tipo: "TEO", profesor: "Docente", aula: "B-05", estado: "ℹ️ Tutoría" },
];

export const mockEvaluaciones = [
  { fecha: "2026-01-20", tipo: "1er Parcial", materia: "Cálculo II", hora: "18:30" },
  { fecha: "2026-01-25", tipo: "1er Parcial", materia: "Física II", hora: "19:00" },
  { fecha: "2026-02-03", tipo: "2do Parcial", materia: "Cálculo II", hora: "18:30" },
  { fecha: "2026-02-10", tipo: "Final", materia: "Programación", hora: "17:00" },
];

export const mockMalla = [
  { sem: 1, materias: [
    { id: "MAT1", nombre: "Álgebra", estado: "aprobada" },
    { id: "MAT2", nombre: "Geometría Analítica", estado: "aprobada" },
    { id: "MAT3", nombre: "Cálculo I", estado: "aprobada" },
  ]},
  { sem: 2, materias: [
    { id: "MAT4", nombre: "Cálculo II", estado: "desbloqueada" },
    { id: "MAT5", nombre: "Física II", estado: "desbloqueada" },
    { id: "MAT6", nombre: "Probabilidad", estado: "bloqueada", faltan: ["Cálculo II"] },
  ]},
  { sem: 3, materias: [
    { id: "MAT7", nombre: "Ecuaciones Diferenciales", estado: "bloqueada", faltan: ["Cálculo II"] },
    { id: "MAT8", nombre: "Estadística", estado: "bloqueada", faltan: ["Probabilidad"] },
  ]},
];
