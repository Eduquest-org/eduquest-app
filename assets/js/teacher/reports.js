// ==========================================================================
// assets/js/teacher/reports.js
// Reportes del aula + exportación a Excel (.xlsx) con SheetJS.
// ==========================================================================

const Reports = {
  data: { students: [], groups: [], sessionsActive: 0, classroomName: "" },
  filter: "all",
  search: "",

  async init() {
    this.data = await TeacherData.load();
    const nameEl = document.getElementById("teacher-classroom-name");
    if (nameEl) nameEl.textContent = this.data.classroomName || "tu aula";
    this.renderStats();
    this.renderTable();
    hideTeacherPreloader();
  },

  visibleStudents() {
    const term = this.search.trim().toLowerCase();
    return this.data.students.filter(s => {
      const matchStatus = this.filter === "all" || s.status === this.filter;
      const matchSearch = !term ||
        s.name.toLowerCase().includes(term) ||
        s.subject.toLowerCase().includes(term) ||
        (s.target || "").toLowerCase().includes(term);
      return matchStatus && matchSearch;
    });
  },

  renderStats() {
    const st = TeacherData.computeStats(this.data.students);
    setReportText("stat-total", st.total);
    setReportText("stat-risk", st.risk);
    setReportText("stat-progress", st.avg + "%");
    setReportText("stat-sessions", this.data.sessionsActive || 0);
  },

  renderTable() {
    const tbody = document.getElementById("report-body");
    if (!tbody) return;
    const list = this.visibleStudents();

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="tbl-empty">No hay alumnos para esos criterios.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(s => {
      const m = TEACHER_STATUS[s.status] || TEACHER_STATUS.moderado;
      return `
        <tr>
          <td><div class="student-cell"><div class="student-avatar">${teacherEsc(s.initials || "··")}</div><span>${teacherEsc(s.name)}</span></div></td>
          <td>${teacherEsc(s.subject)}</td>
          <td>${teacherEsc(s.target)}</td>
          <td><div class="prog"><div class="prog-fill" style="width:${s.progress}%; background:${m.color};"></div></div><span class="xs col-m">${s.progress}%</span></td>
          <td><span class="badge ${m.badge}">${m.label}</span></td>
          <td class="sm">${teacherEsc(s.lastActivity)}</td>
        </tr>`;
    }).join("");
  },

  /** Construye el libro Excel (separado de la descarga para poder testearlo). */
  buildWorkbook() {
    const rows = this.visibleStudents().map(s => ({
      "Alumno": s.name,
      "Materia": s.subject,
      "Meta": s.target,
      "Avance (%)": s.progress,
      "Estado": (TEACHER_STATUS[s.status] || {}).label || s.status,
      "Última actividad": s.lastActivity
    }));

    const wb = XLSX.utils.book_new();

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 11 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, "Alumnos");

    const st = TeacherData.computeStats(this.data.students);
    const summary = [
      ["Reporte de Aula — EduQuest"],
      ["Aula", this.data.classroomName || ""],
      ["Generado", new Date().toLocaleString("es-PE")],
      [],
      ["Métrica", "Valor"],
      ["Total alumnos", st.total],
      ["En riesgo", st.risk],
      ["Avance promedio (%)", st.avg],
      ["Sesiones activas", this.data.sessionsActive || 0]
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(summary);
    ws2["!cols"] = [{ wch: 24 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Resumen");

    return wb;
  }
};

function setReportText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ─── Acciones globales ────────────────────────────────────────────────
function filterByStatus(value) {
  Reports.filter = value || "all";
  Reports.renderTable();
}

// El buscador de la topbar compartida filtra el reporte.
window.filterTeacherStudents = function (value) {
  Reports.search = value || "";
  Reports.renderTable();
};

function exportExcel() {
  if (typeof XLSX === "undefined") {
    teacherToast("⚠️ No se pudo cargar el generador de Excel (¿sin conexión?).");
    return;
  }
  if (!Reports.visibleStudents().length) {
    teacherToast("No hay datos para exportar con el filtro actual.");
    return;
  }
  try {
    const wb = Reports.buildWorkbook();
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `reporte-aula-eduquest-${date}.xlsx`);
    teacherToast("✅ Reporte exportado a Excel (.xlsx)");
  } catch (e) {
    console.error("Error exportando Excel:", e);
    teacherToast("⚠️ Ocurrió un error al generar el Excel.");
  }
}

document.addEventListener("DOMContentLoaded", () => Reports.init());

window.filterByStatus = filterByStatus;
window.exportExcel = exportExcel;
window.Reports = Reports;
