// ==========================================================================
// assets/js/teacher/teacher-common.js
// UTILIDADES COMPARTIDAS DEL PANEL DOCENTE
// ==========================================================================
// Temas de curso (iconos/colores), helpers de formato y clasificación de
// alumnos. Lo consumen classrooms.js, analytics.js y reports.js.
// No declara variables sueltas: todo cuelga de `window.TeacherCommon`.
// ==========================================================================

(function () {
  "use strict";

  /** Colores de avatar reutilizables (en orden de rotación). */
  const AVATAR_COLORS = ["#6E61E0", "#B45309", "#0E8F86", "#C2486B", "#516390"];

  /** Cursos disponibles al crear una sección. */
  const COURSE_LIST = [
    "Física",
    "Álgebra",
    "Química",
    "Razonamiento Matemático",
    "Aritmética",
    "Geometría",
    "Razonamiento Verbal",
    "Comprensión de Lectura",
  ];

  const DEFAULT_THEME = {
    color: "var(--slate)",
    soft: "var(--slate-soft)",
    chart: "#516390",
  };

  /**
   * Tema visual por curso.
   * `color`/`soft` son variables CSS (chips e iconos); `chart` es un hex
   * concreto para los lienzos de Chart.js.
   */
  const COURSE_THEME = {
    "Física": { color: "var(--brand)", soft: "var(--brand-soft)", chart: "#7F77DD" },
    "Álgebra": { color: "var(--amber-dark)", soft: "var(--amber-soft)", chart: "#EF9F27" },
    "Química": { color: "var(--teal)", soft: "var(--teal-soft)", chart: "#0E8F86" },
    "Razonamiento Matemático": { color: "var(--rose)", soft: "var(--rose-soft)", chart: "#C2486B" },
    "Aritmética": { color: "var(--slate)", soft: "var(--slate-soft)", chart: "#3498DB" },
    "Geometría": { color: "var(--teal)", soft: "var(--teal-soft)", chart: "#1D9E75" },
    "Razonamiento Verbal": { color: "var(--amber-dark)", soft: "var(--amber-soft)", chart: "#F39C12" },
    "Comprensión de Lectura": { color: "var(--rose)", soft: "var(--rose-soft)", chart: "#E24B4A" },
  };

  const DEFAULT_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>';

  /** Icono SVG por curso. */
  const COURSE_ICONS = {
    "Física": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="9.5" ry="4.2"/><ellipse cx="12" cy="12" rx="9.5" ry="4.2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="4.2" transform="rotate(120 12 12)"/></svg>',
    "Álgebra": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18c4-14 8-14 8 0M12 18c4-14 8-14 8 0"/></svg>',
    "Química": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6.5L4.6 18a2 2 0 0 0 1.7 3h11.4a2 2 0 0 0 1.7-3L14 9.5V3"/><path d="M7.5 14h9"/></svg>',
    "Razonamiento Matemático": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><circle cx="8" cy="10.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="12" cy="10.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="16" cy="10.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="8" cy="14.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="12" cy="14.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="16" cy="14.5" r="0.9" fill="currentColor" stroke="none"/><line x1="8" y1="18.5" x2="16" y2="18.5"/></svg>',
    "Aritmética": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>',
    "Geometría": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 20h20L12 2Z"/></svg>',
    "Razonamiento Verbal": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg>',
    "Comprensión de Lectura": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z"/></svg>',
  };

  /** Tipos de actividad asignable a una sección. */
  const ACTIVITY_TYPES = {
    tarea: { label: "Tarea", verb: "Asignar tarea", icon: "📋" },
    reto: { label: "Reto", verb: "Crear reto", icon: "🏆" },
    quiz: { label: "Quiz", verb: "Crear quiz", icon: "⚡" },
  };

  const TeacherCommon = {
    AVATAR_COLORS,
    COURSE_LIST,
    COURSE_THEME,
    COURSE_ICONS,
    ACTIVITY_TYPES,

    /** Devuelve el tema del curso (con fallback). */
    themeFor(course) {
      return COURSE_THEME[course] || DEFAULT_THEME;
    },

    /** Devuelve el icono SVG del curso (con fallback). */
    iconFor(course) {
      return COURSE_ICONS[course] || DEFAULT_ICON;
    },

    /** Color de avatar por índice (rotación). */
    avatarColor(index) {
      return AVATAR_COLORS[index % AVATAR_COLORS.length];
    },

    /** Iniciales (máx. 2 letras) a partir de un nombre completo. */
    initials(name) {
      if (!name) return "?";
      return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase();
    },

    /** Formatea un número con separadores de miles (es-PE). */
    formatNumber(value) {
      return Number(value || 0).toLocaleString("es-PE");
    },

    /** Liga gamificada según XP acumulado. */
    ligaFor(xp) {
      if (xp >= 2800) return { label: "Liga Platino", cls: "plat" };
      if (xp >= 2000) return { label: "Liga Oro", cls: "oro" };
      if (xp >= 1200) return { label: "Liga Plata", cls: "plata" };
      return { label: "Liga Bronce", cls: "bronce" };
    },

    /**
     * Banda de rendimiento según porcentaje de aciertos.
     * Se usa para la distribución del dashboard grupal.
     */
    performanceBand(accuracy) {
      if (accuracy >= 85) return { key: "excelente", label: "Excelente", color: "#1D9E75" };
      if (accuracy >= 70) return { key: "bueno", label: "Bueno", color: "#7F77DD" };
      if (accuracy >= 55) return { key: "regular", label: "Regular", color: "#EF9F27" };
      return { key: "riesgo", label: "En riesgo", color: "#E24B4A" };
    },

    /** Días transcurridos desde una fecha ISO (yyyy-mm-dd). */
    daysSince(dateStr) {
      if (!dateStr) return Infinity;
      const then = new Date(dateStr).getTime();
      if (Number.isNaN(then)) return Infinity;
      return Math.floor((Date.now() - then) / 86400000);
    },

    /**
     * Estado de conexión del alumno según su última actividad.
     * Úsalo para alertas y reportes.
     */
    statusFor(student) {
      const days = this.daysSince(student.lastActive);
      if (days <= 3) return { key: "al-dia", label: "Al día" };
      if (days <= 7) return { key: "atento", label: "Seguimiento" };
      return { key: "inactivo", label: "Inactivo" };
    },

    /** Formatea una fecha ISO a formato legible es-PE (dd mmm yyyy). */
    formatDate(dateStr) {
      if (!dateStr) return "—";
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return "—";
      return date.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    },

    /** Escapa texto para insertarlo de forma segura como HTML. */
    escapeHtml(value) {
      const div = document.createElement("div");
      div.textContent = value == null ? "" : String(value);
      return div.innerHTML;
    },

    /**
     * Genera un número estable (mismo input → mismo output) a partir de un
     * texto semilla, centrado en `base` con dispersión ±`spread`, acotado
     * a [0, 100]. Sirve para derivar detalle por tema sin inflar el mock.
     */
    seededScore(seed, base, spread) {
      let hash = 0;
      const str = String(seed);
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      const norm = (Math.abs(hash) % 1000) / 1000; // 0..1 estable
      const value = Math.round(base + (norm * 2 - 1) * spread);
      return Math.max(0, Math.min(100, value));
    },

    /**
     * Detalle de aciertos por tema para un alumno, derivado de su precisión
     * global con una variación estable por tema.
     * @returns {Array<{topic:string, score:number}>}
     */
    topicScoresFor(student, topics) {
      const base = student.accuracy || 60;
      return (topics || []).map((topic) => ({
        topic,
        score: this.seededScore(`${student.id}:${topic}`, base, 16),
      }));
    },
  };

  window.TeacherCommon = TeacherCommon;
})();
