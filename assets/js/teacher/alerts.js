// ==========================================================================
// assets/js/teacher/alerts.js
// Vista dedicada de alertas del aula (derivadas de los datos).
// ==========================================================================

const AlertsView = {
  data: { students: [], groups: [] },

  async init() {
    this.data = await TeacherData.load();
    const n = document.getElementById("teacher-classroom-name");
    if (n) n.textContent = this.data.classroomName || "tu aula";
    this.render();
    hideTeacherPreloader();
  },

  build() {
    const alerts = [];
    this.data.students
      .filter(s => s.status === "riesgo")
      .forEach(s => alerts.push({
        sev: "r",
        title: `${s.name} en riesgo`,
        sub: `${s.subject} · ${s.progress < 30 ? "Crítico" : "Riesgo alto"} · avance ${s.progress}%`
      }));
    this.data.students
      .filter(s => s.status === "moderado")
      .forEach(s => alerts.push({
        sev: "a",
        title: `${s.name} — rendimiento moderado`,
        sub: `${s.subject} · Intervención sugerida · avance ${s.progress}%`
      }));
    this.data.groups
      .filter(g => g.status === "atencion")
      .forEach(g => alerts.push({
        sev: "a",
        title: `${g.name} — promedio bajo esta semana`,
        sub: `${g.members} alumnos · Intervención sugerida`
      }));
    // Rojas primero
    return alerts.sort((a, b) => (a.sev === "r" ? 0 : 1) - (b.sev === "r" ? 0 : 1));
  },

  render() {
    const list = this.build();
    setAlertText("stat-high", list.filter(a => a.sev === "r").length);
    setAlertText("stat-mid", list.filter(a => a.sev === "a").length);

    const cont = document.getElementById("alerts-list");
    if (!cont) return;
    if (!list.length) {
      cont.innerHTML = `<p class="sm col-m" style="padding:8px 0;">Sin alertas pendientes 🎉</p>`;
      return;
    }
    cont.innerHTML = list.map(a => `
      <div class="al-item">
        <div class="al-dot ${a.sev}"></div>
        <div style="flex:1; min-width:0;">
          <div class="al-title">${teacherEsc(a.title)}</div>
          <div class="al-sub">${teacherEsc(a.sub)}</div>
        </div>
        <span class="alert-sev ${a.sev}">${a.sev === "r" ? "Alta" : "Media"}</span>
        <button class="row-action normal" style="margin-left:14px;" onclick="dismissAlert(this)">Atender</button>
      </div>`).join("");
  }
};

function setAlertText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

function dismissAlert(btn) {
  const item = btn.closest(".al-item");
  if (!item) return;
  item.style.transition = "opacity .25s, transform .25s";
  item.style.opacity = "0";
  item.style.transform = "translateX(12px)";
  setTimeout(() => {
    item.remove();
    teacherToast("✅ Alerta marcada como atendida");
    const cont = document.getElementById("alerts-list");
    if (cont && !cont.querySelector(".al-item")) {
      cont.innerHTML = `<p class="sm col-m" style="padding:8px 0;">Sin alertas pendientes 🎉</p>`;
    }
  }, 250);
}

document.addEventListener("DOMContentLoaded", () => AlertsView.init());
window.dismissAlert = dismissAlert;
window.AlertsView = AlertsView;
