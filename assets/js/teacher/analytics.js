// ==========================================================================
// assets/js/teacher/analytics.js
// Analíticas agregadas del aula (barras CSS, sin librerías de gráficos).
// ==========================================================================

const Analytics = {
  data: { students: [] },

  async init() {
    this.data = await TeacherData.load();
    const n = document.getElementById("teacher-classroom-name");
    if (n) n.textContent = this.data.classroomName || "tu aula";
    this.renderStats();
    this.renderSubjects();
    this.renderStatus();
    this.renderLists();
    hideTeacherPreloader();
  },

  renderStats() {
    const st = TeacherData.computeStats(this.data.students);
    const subjects = new Set(this.data.students.map(s => s.subject)).size;
    setAText("stat-total", st.total);
    setAText("stat-risk", st.risk);
    setAText("stat-progress", st.avg + "%");
    setAText("stat-subjects", subjects);
  },

  renderSubjects() {
    const cont = document.getElementById("bars-subject");
    if (!cont) return;
    const rows = TeacherData.avgBySubject(this.data.students);
    cont.innerHTML = rows.length
      ? rows.map(r => barRow(`${r.subject}`, r.avg, "var(--indigo)", `${r.avg}%`)).join("")
      : `<p class="sm col-m">Sin datos.</p>`;
  },

  renderStatus() {
    const cont = document.getElementById("bars-status");
    const legend = document.getElementById("status-legend");
    if (!cont) return;
    const counts = TeacherData.countByStatus(this.data.students);
    const total = this.data.students.length || 1;
    const order = ["excelente", "encamino", "moderado", "riesgo"];

    cont.innerHTML = order.map(k => {
      const n = counts[k];
      const pct = Math.round((n / total) * 100);
      return barRow(TEACHER_STATUS[k].label, pct, TEACHER_STATUS[k].color, `${n} · ${pct}%`);
    }).join("");

    if (legend) {
      legend.innerHTML = order.map(k =>
        `<span class="legend-item"><span class="legend-dot" style="background:${TEACHER_STATUS[k].color}"></span>${TEACHER_STATUS[k].label}</span>`
      ).join("");
    }
  },

  renderLists() {
    const support = this.data.students
      .filter(s => s.status === "riesgo" || s.status === "moderado")
      .sort((a, b) => a.progress - b.progress)
      .slice(0, 5);
    const top = this.data.students
      .filter(s => s.status === "excelente" || s.status === "encamino")
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 5);

    renderMiniList("list-support", support, "🎉 Nadie necesita apoyo urgente.");
    renderMiniList("list-top", top, "Sin datos todavía.");
  }
};

function setAText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

function barRow(label, widthPct, color, valText) {
  const w = Math.max(0, Math.min(100, widthPct));
  return `
    <div class="bar-row">
      <div class="bar-label" title="${teacherEsc(label)}">${teacherEsc(label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${w}%; background:${color};"></div></div>
      <div class="bar-val">${teacherEsc(valText)}</div>
    </div>`;
}

function renderMiniList(id, list, emptyMsg) {
  const cont = document.getElementById(id);
  if (!cont) return;
  if (!list.length) { cont.innerHTML = `<p class="sm col-m">${emptyMsg}</p>`; return; }
  cont.innerHTML = list.map(s => {
    const m = TEACHER_STATUS[s.status] || TEACHER_STATUS.moderado;
    return `
      <div class="al-item">
        <div class="student-avatar">${teacherEsc(s.initials || "··")}</div>
        <div style="flex:1; min-width:0;">
          <div class="al-title">${teacherEsc(s.name)}</div>
          <div class="al-sub">${teacherEsc(s.subject)} · ${teacherEsc(s.target)}</div>
        </div>
        <span class="badge ${m.badge}">${s.progress}%</span>
      </div>`;
  }).join("");
}

document.addEventListener("DOMContentLoaded", () => Analytics.init());
window.Analytics = Analytics;
