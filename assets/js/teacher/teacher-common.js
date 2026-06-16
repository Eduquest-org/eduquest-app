// ==========================================================================
// assets/js/teacher/teacher-common.js
// Utilidades compartidas por las vistas del panel docente
// (Analytics, Alertas, Reportes, Grupos, Configuración).
// ==========================================================================

const TEACHER_STATUS = {
  encamino:  { label: "En camino", badge: "bg", color: "var(--green)"  },
  excelente: { label: "Excelente", badge: "bg", color: "var(--green)"  },
  moderado:  { label: "Moderado",  badge: "ba", color: "var(--amber)"  },
  riesgo:    { label: "En riesgo", badge: "br", color: "var(--red)"    }
};

const TeacherData = {
  _cache: null,
  async load() {
    if (this._cache) return this._cache;
    try {
      const r = await fetch("../../mock/teacher-classroom.json");
      if (!r.ok) throw new Error("HTTP " + r.status);
      this._cache = await r.json();
    } catch (e) {
      console.error("Error cargando el aula del docente:", e);
      this._cache = { students: [], groups: [], sessionsActive: 0, classroomName: "" };
    }
    return this._cache;
  },
  computeStats(students) {
    const total = students.length;
    const risk = students.filter(s => s.status === "riesgo").length;
    const avg = total ? Math.round(students.reduce((a, s) => a + (s.progress || 0), 0) / total) : 0;
    return { total, risk, avg };
  },
  /** Promedio de avance por materia: { materia: promedio } */
  avgBySubject(students) {
    const acc = {};
    students.forEach(s => {
      (acc[s.subject] = acc[s.subject] || []).push(s.progress || 0);
    });
    return Object.entries(acc)
      .map(([subject, arr]) => ({ subject, avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length), count: arr.length }))
      .sort((a, b) => b.avg - a.avg);
  },
  /** Conteo por estado: { encamino, excelente, moderado, riesgo } */
  countByStatus(students) {
    const c = { encamino: 0, excelente: 0, moderado: 0, riesgo: 0 };
    students.forEach(s => { if (c[s.status] !== undefined) c[s.status]++; });
    return c;
  }
};

function teacherEsc(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function hideTeacherPreloader() {
  setTimeout(() => {
    const p = document.getElementById("app-preloader");
    if (p) { p.classList.add("fade-out-loader"); setTimeout(() => p.remove(), 400); }
  }, 250);
}

function teacherToast(msg) {
  let t = document.getElementById("teacher-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "teacher-toast";
    t.className = "teacher-toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2600);
}

// Fallback seguro: el buscador de la topbar (compartida) llama a esta función;
// las páginas que tienen tabla la sobrescriben con su propio filtro.
if (!window.filterTeacherStudents) window.filterTeacherStudents = () => {};

// notifyComingSoon sigue disponible por si algún enlace futuro lo usa.
function notifyComingSoon(label) { teacherToast(`🛠️ "${label}" estará disponible próximamente.`); }

window.TEACHER_STATUS = TEACHER_STATUS;
window.TeacherData = TeacherData;
window.teacherEsc = teacherEsc;
window.hideTeacherPreloader = hideTeacherPreloader;
window.teacherToast = teacherToast;
window.notifyComingSoon = notifyComingSoon;
