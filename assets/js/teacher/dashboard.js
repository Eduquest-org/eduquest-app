// ==========================================================================
// assets/js/teacher/dashboard.js
// DASHBOARD DOCENTE — datos desde mock/teacher-classroom.json.
// Las métricas se CALCULAN desde la data (no están hardcodeadas).
// ==========================================================================

const STATUS_MAP = {
  encamino:  { label: "En camino", badge: "bg", color: "var(--green)" },
  excelente: { label: "Excelente", badge: "bg", color: "var(--green)" },
  moderado:  { label: "Moderado",  badge: "ba", color: "var(--amber)" },
  riesgo:    { label: "En riesgo", badge: "br", color: "var(--red)"   }
};

const TeacherDashboard = {
  data: { students: [], groups: [], sessionsActive: 0, classroomName: "" },
  filters: { search: "", status: "all" },

  async load() {
    try {
      const res = await fetch("../../mock/teacher-classroom.json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      this.data = await res.json();
    } catch (e) {
      console.error("Error cargando el aula del docente:", e);
    }
    const classEl = document.getElementById("teacher-classroom-name");
    if (classEl) classEl.textContent = this.data.classroomName || "tu aula";
    this.renderAll();
    hideTeacherPreloader();
  },

  getFilteredStudents() {
    const term = this.filters.search.trim().toLowerCase();
    return this.data.students.filter(s => {
      const matchStatus = this.filters.status === "all" || s.status === this.filters.status;
      const matchSearch = !term ||
        s.name.toLowerCase().includes(term) ||
        s.subject.toLowerCase().includes(term) ||
        (s.target || "").toLowerCase().includes(term);
      return matchStatus && matchSearch;
    });
  },

  renderAll() {
    this.renderStats();
    this.renderStudents();
    this.renderAlerts();
    this.renderGroups();
  },

  renderStats() {
    const s = this.data.students;
    const total = s.length;
    const risk = s.filter(x => x.status === "riesgo").length;
    const avg = total ? Math.round(s.reduce((a, x) => a + (x.progress || 0), 0) / total) : 0;

    setText("stat-total", total);
    setText("stat-risk", risk);
    setText("stat-progress", avg + "%");
    setText("stat-sessions", this.data.sessionsActive || 0);
  },

  renderStudents() {
    const tbody = document.getElementById("teacher-students-body");
    if (!tbody) return;
    const list = this.getFilteredStudents();

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="tbl-empty">No se encontraron alumnos con esos criterios.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(s => {
      const m = STATUS_MAP[s.status] || STATUS_MAP.moderado;
      const danger = s.status === "riesgo";
      const actionLabel = danger ? (s.progress < 30 ? "⚠ Urgente" : "Intervenir") : "Ver perfil";
      const actionFn = danger ? `interveneStudent('${s.id}')` : `viewStudent('${s.id}')`;
      const actionCls = danger ? "danger" : "normal";

      return `
        <tr>
          <td>
            <div class="student-cell">
              <div class="student-avatar">${s.initials || "··"}</div>
              <span>${s.name}</span>
            </div>
          </td>
          <td>${s.subject} · ${s.target}</td>
          <td>
            <div class="prog"><div class="prog-fill" style="width:${s.progress}%; background:${m.color};"></div></div>
            <span class="xs col-m">${s.progress}%</span>
          </td>
          <td class="sm">${s.lastActivity}</td>
          <td><span class="badge ${m.badge}">${m.label}</span></td>
          <td><button class="row-action ${actionCls}" onclick="${actionFn}">${actionLabel}</button></td>
        </tr>`;
    }).join("");
  },

  renderAlerts() {
    const cont = document.getElementById("teacher-alerts");
    if (!cont) return;

    const alerts = [];
    this.data.students
      .filter(s => s.status === "riesgo")
      .forEach(s => alerts.push({ sev: "r", title: s.name, sub: `${s.subject} · ${s.progress < 30 ? "Crítico" : "Riesgo alto"}` }));
    this.data.students
      .filter(s => s.status === "moderado")
      .forEach(s => alerts.push({ sev: "a", title: `${s.name} — rendimiento moderado`, sub: `${s.subject} · Intervención sugerida` }));
    this.data.groups
      .filter(g => g.status === "atencion")
      .forEach(g => alerts.push({ sev: "a", title: `${g.name} — promedio bajo`, sub: "Intervención sugerida" }));

    const top = alerts.slice(0, 5);
    cont.innerHTML = top.length
      ? top.map(a => `
          <div class="al-item">
            <div class="al-dot ${a.sev}"></div>
            <div><div class="al-title">${a.title}</div><div class="al-sub">${a.sub}</div></div>
          </div>`).join("")
      : `<p class="sm col-m">Sin alertas pendientes 🎉</p>`;
  },

  renderGroups() {
    const cont = document.getElementById("teacher-groups");
    if (!cont) return;
    cont.innerHTML = this.data.groups.map(g => {
      const badge = g.status === "atencion"
        ? `<span class="badge ba">Atención</span>`
        : `<span class="badge bg">Activo</span>`;
      return `
        <div class="group-item">
          <div><div class="group-name">${g.name}</div><div class="group-sub">${g.members} alumnos</div></div>
          ${badge}
        </div>`;
    }).join("");
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function hideTeacherPreloader() {
  setTimeout(() => {
    const p = document.getElementById("app-preloader");
    if (p) { p.classList.add("fade-out-loader"); setTimeout(() => p.remove(), 400); }
  }, 250);
}

// ─── Acciones globales (usadas por onclick/oninput inline) ───────────────
function filterTeacherStudents(value) {
  TeacherDashboard.filters.search = value || "";
  TeacherDashboard.renderStudents();
}

function filterByStatus(value) {
  TeacherDashboard.filters.status = value || "all";
  TeacherDashboard.renderStudents();
}

function addStudentPrompt() {
  const name = prompt("Nombre completo del nuevo alumno:");
  if (!name || !name.trim()) return;
  const subject = (prompt("Materia principal:", "Álgebra") || "General").trim();
  const target = (prompt("Universidad meta (UNI / San Marcos / PUCP):", "UNI") || "UNI").trim();

  const parts = name.trim().split(/\s+/);
  const initials = (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();

  TeacherDashboard.data.students.push({
    id: "S_" + Date.now(),
    name: name.trim(),
    initials,
    subject,
    target,
    progress: 5,
    lastActivity: "recién",
    status: "encamino"
  });

  // Si hay un filtro de estado activo que ocultaría al nuevo alumno, lo reseteamos
  if (TeacherDashboard.filters.status !== "all" && TeacherDashboard.filters.status !== "encamino") {
    TeacherDashboard.filters.status = "all";
    const sel = document.getElementById("teacher-filter");
    if (sel) sel.value = "all";
  }

  TeacherDashboard.renderStats();
  TeacherDashboard.renderStudents();
}

function viewStudent(id) {
  const s = TeacherDashboard.data.students.find(x => x.id === id);
  if (!s) return;
  const label = (STATUS_MAP[s.status] || {}).label || s.status;
  alert(`👤 ${s.name}\n\nMateria: ${s.subject} · Meta: ${s.target}\nAvance: ${s.progress}%\nEstado: ${label}\nÚltima actividad: ${s.lastActivity}\n\n(Perfil detallado próximamente)`);
}

function interveneStudent(id) {
  const s = TeacherDashboard.data.students.find(x => x.id === id);
  if (!s) return;
  alert(`🚨 Intervención para ${s.name}\n\nSe enviará un recordatorio al alumno y se registrará el seguimiento.\nMateria en riesgo: ${s.subject} (${s.progress}%).\n\n(Acción simulada — sin backend)`);
}

function notifyComingSoon(label) {
  alert(`🛠️ "${label}" estará disponible próximamente en el panel docente.`);
}

document.addEventListener("DOMContentLoaded", () => TeacherDashboard.load());

// Exponer para los onclick/oninput inline
window.filterTeacherStudents = filterTeacherStudents;
window.filterByStatus = filterByStatus;
window.addStudentPrompt = addStudentPrompt;
window.viewStudent = viewStudent;
window.interveneStudent = interveneStudent;
window.notifyComingSoon = notifyComingSoon;
