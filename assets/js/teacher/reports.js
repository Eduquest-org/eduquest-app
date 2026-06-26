// ==========================================================================
// assets/js/teacher/reports.js
// US-18 · Exportación de reportes de progreso (CSV / Excel / PDF)
// Un único modelo de columnas alimenta la vista previa y las exportaciones.
// ==========================================================================

(function () {
  "use strict";

  const Common = window.TeacherCommon;
  const Store = window.TeacherStore;
  const UI = window.TeacherUI;

  const ALL = "__all__";
  const state = { scope: ALL, type: "alumno", period: "Todo el periodo" };

  // ─── Construcción de filas ──────────────────────────────────────────

  function studentRow(student, sectionName) {
    const status = Common.statusFor(student);
    return {
      Seccion: sectionName,
      Alumno: student.name,
      Liga: Common.ligaFor(student.xp || 0).label,
      XP: student.xp || 0,
      Aciertos: student.accuracy || 0,
      Avance: student.completion || 0,
      Simulacros: student.simulacros || 0,
      Estado: status.label,
      Conexion: Common.formatDate(student.lastActive),
      _statusKey: status.key,
    };
  }

  function summaryRow(section) {
    const stats = Store.computeStats(section);
    return {
      Seccion: section.name,
      Curso: section.course,
      Alumnos: stats.students,
      XPProm: stats.avgXp,
      AciertosProm: stats.avgAccuracy,
      AvanceProm: stats.avgCompletion,
      Actividad: stats.activity,
      EnRiesgo: stats.atRisk,
    };
  }

  // ─── Definición del reporte (columnas + filas + KPIs) ───────────────

  function buildReport() {
    const sections = Store.getSections();
    const scoped = state.scope === ALL ? sections : sections.filter((s) => s.id === state.scope);
    const scopeLabel = state.scope === ALL ? "Todas las secciones" : scoped[0] ? scoped[0].name : "—";

    const teacher = (window.CurrentUserService && CurrentUserService.getName()) || "Docente";
    const meta = {
      scopeLabel,
      period: state.period,
      date: new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" }),
      teacher,
    };

    let columns;
    let rows;
    let title;
    let kpis;
    let sheetName;

    if (state.type === "resumen") {
      title = "Resumen de aulas";
      sheetName = "Resumen";
      columns = [
        { header: "Sección", key: "Seccion" },
        { header: "Curso", key: "Curso" },
        { header: "Alumnos", key: "Alumnos", num: true },
        { header: "XP promedio", key: "XPProm", num: true },
        { header: "Aciertos prom.", key: "AciertosProm", num: true, suffix: "%" },
        { header: "Avance prom.", key: "AvanceProm", num: true, suffix: "%" },
        { header: "Actividad", key: "Actividad", num: true, suffix: "%" },
        { header: "En riesgo", key: "EnRiesgo", num: true },
      ];
      rows = scoped.map(summaryRow);

      const totalStudents = rows.reduce((a, r) => a + r.Alumnos, 0);
      const avgAcc = rows.length ? Math.round(rows.reduce((a, r) => a + r.AciertosProm, 0) / rows.length) : 0;
      const atRisk = rows.reduce((a, r) => a + r.EnRiesgo, 0);
      kpis = [
        { label: "Secciones", value: rows.length },
        { label: "Alumnos", value: totalStudents },
        { label: "Aciertos promedio", value: avgAcc + "%" },
        { label: "En riesgo", value: atRisk },
      ];
    } else {
      title = state.scope === ALL ? "Progreso por alumno · Todas las secciones" : `Progreso por alumno · ${scopeLabel}`;
      sheetName = "Alumnos";
      columns = [];
      if (state.scope === ALL) columns.push({ header: "Sección", key: "Seccion" });
      columns.push(
        { header: "Alumno", key: "Alumno" },
        { header: "Liga", key: "Liga" },
        { header: "XP", key: "XP", num: true },
        { header: "Aciertos", key: "Aciertos", num: true, suffix: "%" },
        { header: "Avance", key: "Avance", num: true, suffix: "%" },
        { header: "Simulacros", key: "Simulacros", num: true },
        { header: "Estado", key: "Estado", badge: true },
        { header: "Última conexión", key: "Conexion" }
      );

      rows = [];
      scoped.forEach((section) => {
        (section.students || [])
          .slice()
          .sort((a, b) => (b.xp || 0) - (a.xp || 0))
          .forEach((st) => rows.push(studentRow(st, section.name)));
      });

      const n = rows.length;
      const avgAcc = n ? Math.round(rows.reduce((a, r) => a + r.Aciertos, 0) / n) : 0;
      const avgComp = n ? Math.round(rows.reduce((a, r) => a + r.Avance, 0) / n) : 0;
      // Mismo criterio que computeStats().atRisk: bandas "regular" + "riesgo".
      const atRisk = rows.filter((r) => {
        const band = Common.performanceBand(r.Aciertos).key;
        return band === "regular" || band === "riesgo";
      }).length;
      kpis = [
        { label: "Alumnos", value: n },
        { label: "Aciertos promedio", value: avgAcc + "%" },
        { label: "Avance promedio", value: avgComp + "%" },
        { label: "En riesgo", value: atRisk },
      ];
    }

    const filenameBase = `EduQuest_Reporte_${slug(scopeLabel)}_${state.type}_${isoDate()}`;
    return { title, meta, columns, rows, kpis, sheetName, filenameBase };
  }

  // ─── Vista previa ───────────────────────────────────────────────────

  function renderPreview() {
    const report = buildReport();

    setHtml(
      "reportMeta",
      `<div><span>Sección:</span> ${Common.escapeHtml(report.meta.scopeLabel)}</div>
       <div><span>Periodo:</span> ${Common.escapeHtml(report.meta.period)}</div>
       <div><span>Docente:</span> ${Common.escapeHtml(report.meta.teacher)}</div>
       <div><span>Emitido:</span> ${Common.escapeHtml(report.meta.date)}</div>`
    );
    setText("reportTitle", report.title);

    setHtml(
      "reportKpis",
      report.kpis
        .map(
          (k) =>
            `<div class="rd-kpi"><div class="rdk-value">${Common.escapeHtml(k.value)}</div><div class="rdk-label">${Common.escapeHtml(k.label)}</div></div>`
        )
        .join("")
    );

    setHtml(
      "reportThead",
      `<tr>${report.columns.map((c) => `<th class="${c.num ? "num" : ""}">${Common.escapeHtml(c.header)}</th>`).join("")}</tr>`
    );

    const body = document.getElementById("reportTbody");
    if (report.rows.length === 0) {
      body.innerHTML = `<tr><td colspan="${report.columns.length}" class="table-empty">No hay datos para esta selección.</td></tr>`;
    } else {
      body.innerHTML = report.rows
        .map(
          (row) =>
            `<tr>${report.columns
              .map((c) => {
                const raw = row[c.key];
                if (c.badge) {
                  return `<td><span class="badge ${row._statusKey}">${Common.escapeHtml(raw)}</span></td>`;
                }
                const text = raw === "" || raw == null ? "—" : raw + (c.suffix || "");
                return `<td class="${c.num ? "num" : ""}">${Common.escapeHtml(text)}</td>`;
              })
              .join("")}</tr>`
        )
        .join("");
    }
    return report;
  }

  // ─── Exportaciones ──────────────────────────────────────────────────

  function csvCell(value) {
    const s = value == null ? "" : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportCsv() {
    const report = buildReport();
    if (!report.rows.length) return UI.toast("No hay datos para exportar.", "info");

    const matrix = [report.columns.map((c) => c.header)];
    report.rows.forEach((r) => matrix.push(report.columns.map((c) => r[c.key])));
    const csv = matrix.map((row) => row.map(csvCell).join(",")).join("\r\n");

    // BOM (﻿) para que Excel reconozca la codificación UTF-8.
    download(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }), report.filenameBase + ".csv");
    UI.toast("Reporte CSV descargado");
  }

  function exportXlsx() {
    if (typeof XLSX === "undefined") {
      return UI.toast("La librería de Excel no se cargó. Revisa tu conexión.", "info");
    }
    const report = buildReport();
    if (!report.rows.length) return UI.toast("No hay datos para exportar.", "info");

    const wb = XLSX.utils.book_new();

    // Hoja de datos
    const aoa = [report.columns.map((c) => c.header)];
    report.rows.forEach((r) => aoa.push(report.columns.map((c) => r[c.key])));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = report.columns.map((c) => ({ wch: Math.max(c.header.length + 2, 12) }));
    XLSX.utils.book_append_sheet(wb, ws, report.sheetName);

    // Hoja de información / portada
    const info = [
      ["Reporte", report.title],
      ["Sección", report.meta.scopeLabel],
      ["Periodo", report.meta.period],
      ["Docente", report.meta.teacher],
      ["Emitido", report.meta.date],
      [],
      ...report.kpis.map((k) => [k.label, k.value]),
    ];
    const wsInfo = XLSX.utils.aoa_to_sheet(info);
    wsInfo["!cols"] = [{ wch: 20 }, { wch: 32 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, "Información");

    XLSX.writeFile(wb, report.filenameBase + ".xlsx");
    UI.toast("Reporte Excel descargado");
  }

  function printReport() {
    renderPreview();
    window.print();
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function slug(text) {
    return String(text)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40);
  }

  function isoDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
  function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  // ─── Wiring ─────────────────────────────────────────────────────────

  function populateSectionSelect(preferredId) {
    const select = document.getElementById("reportSection");
    if (!select) return;
    const sections = Store.getSections();
    const opts = [`<option value="${ALL}">Todas las secciones</option>`];
    sections.forEach((s) => opts.push(`<option value="${Common.escapeHtml(s.id)}">${Common.escapeHtml(s.name)}</option>`));
    select.innerHTML = opts.join("");
    if (preferredId && sections.some((s) => s.id === preferredId)) {
      select.value = preferredId;
      state.scope = preferredId;
    }
  }

  function bindEvents() {
    document.getElementById("reportSection")?.addEventListener("change", (e) => {
      state.scope = e.target.value;
      renderPreview();
    });
    document.getElementById("reportPeriod")?.addEventListener("change", (e) => {
      state.period = e.target.value;
      renderPreview();
    });
    document.getElementById("reportType")?.addEventListener("click", (e) => {
      const tab = e.target.closest(".toolbar-tab");
      if (!tab) return;
      document.querySelectorAll("#reportType .toolbar-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.type = tab.dataset.type;
      renderPreview();
    });

    document.getElementById("exportCsv")?.addEventListener("click", exportCsv);
    document.getElementById("exportXlsx")?.addEventListener("click", exportXlsx);
    document.getElementById("exportPdf")?.addEventListener("click", printReport);
  }

  // ─── Init ───────────────────────────────────────────────────────────
  async function init() {
    if (!Store || !Common || !UI) {
      console.error("[reports] Dependencias del panel docente no cargadas.");
      return;
    }
    await Store.init();

    if (!Store.getSections().length) {
      document.getElementById("reportsBody")?.classList.add("hidden");
      document.getElementById("reportsEmpty")?.classList.remove("hidden");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    populateSectionSelect(params.get("section"));
    bindEvents();
    renderPreview();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
