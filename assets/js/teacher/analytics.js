// ==========================================================================
// assets/js/teacher/analytics.js
// US-06 · Dashboard de rendimiento grupal (y por alumno)
// Datos vía TeacherStore · gráficos con Chart.js
// ==========================================================================

(function () {
  "use strict";

  const Common = window.TeacherCommon;
  const Store = window.TeacherStore;
  const UI = window.TeacherUI;

  // Paleta de gráficos
  const C = {
    green: "#1D9E75",
    red: "#E24B4A",
    brand: "#7F77DD",
    brandDark: "#534AB7",
    amber: "#EF9F27",
    grid: "rgba(20,18,40,.07)",
    text: "#8B8FA0",
  };

  let currentSectionId = null;
  let currentStudents = []; // roster filtrado de la sección activa
  const charts = {}; // instancias de Chart por id de canvas
  let studentChart = null;

  // ─── Utilidades de Chart.js ─────────────────────────────────────────
  function destroyChart(key) {
    if (charts[key]) {
      charts[key].destroy();
      delete charts[key];
    }
  }

  function baseFont() {
    return { family: "'Inter', sans-serif", size: 12 };
  }

  // ─── KPIs ───────────────────────────────────────────────────────────
  function renderKpis(stats) {
    const grid = document.getElementById("kpiGrid");
    if (!grid) return;
    const cards = [
      {
        ico: "amber",
        label: "Aciertos promedio",
        value: stats.avgAccuracy,
        unit: "%",
        foot: `${stats.distribution.excelente} en nivel excelente`,
      },
      {
        ico: "",
        label: "XP promedio",
        value: Common.formatNumber(stats.avgXp),
        unit: "",
        foot: stats.topPerformer ? `Top: ${Common.escapeHtml(stats.topPerformer.name)}` : "",
      },
      {
        ico: "teal",
        label: "Avance promedio",
        value: stats.avgCompletion,
        unit: "%",
        foot: `${stats.totalSimulacros} simulacros resueltos`,
      },
      {
        ico: "red",
        label: "Alumnos en riesgo",
        value: stats.atRisk,
        unit: "",
        foot: `${stats.distribution.riesgo} en riesgo · ${stats.distribution.regular} a vigilar`,
      },
    ];
    grid.innerHTML = cards
      .map(
        (c) => `
      <div class="kpi-card">
        <div class="kpi-top">
          <div class="kpi-ico ${c.ico}">${kpiIcon(c.label)}</div>
          <span class="kpi-label">${c.label}</span>
        </div>
        <div class="kpi-value">${c.value}<span class="unit">${c.unit}</span></div>
        <div class="kpi-foot">${c.foot}</div>
      </div>`
      )
      .join("");
  }

  function kpiIcon(label) {
    const icons = {
      "Aciertos promedio":
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
      "XP promedio":
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
      "Avance promedio":
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
      "Alumnos en riesgo":
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    };
    return icons[label] || "";
  }

  // ─── Gráfico 1: aciertos/errores por tema ───────────────────────────
  function renderTopicChart(section) {
    destroyChart("topic");
    const ctx = document.getElementById("topicChart");
    if (!ctx) return;
    const data = section.topicPerformance || [];
    charts.topic = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map((d) => d.topic),
        datasets: [
          { label: "Aciertos", data: data.map((d) => d.correct), backgroundColor: C.green, borderRadius: 5, maxBarThickness: 26 },
          { label: "Errores", data: data.map((d) => d.incorrect), backgroundColor: C.red, borderRadius: 5, maxBarThickness: 26 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { font: baseFont(), boxWidth: 12, boxHeight: 12, usePointStyle: true } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: baseFont(), color: C.text } },
          y: { beginAtZero: true, grid: { color: C.grid }, ticks: { font: baseFont(), color: C.text } },
        },
      },
    });
  }

  // ─── Gráfico 2: distribución de rendimiento ─────────────────────────
  function renderDistChart(stats) {
    destroyChart("dist");
    const ctx = document.getElementById("distChart");
    if (!ctx) return;
    const d = stats.distribution;
    charts.dist = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Excelente", "Bueno", "Regular", "En riesgo"],
        datasets: [
          {
            data: [d.excelente, d.bueno, d.regular, d.riesgo],
            backgroundColor: [C.green, C.brand, C.amber, C.red],
            borderColor: "#fff",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: { legend: { position: "bottom", labels: { font: baseFont(), boxWidth: 12, boxHeight: 12, usePointStyle: true, padding: 14 } } },
      },
    });
  }

  // ─── Gráfico 3: actividad semanal ───────────────────────────────────
  function renderActivityChart(section) {
    destroyChart("activity");
    const ctx = document.getElementById("activityChart");
    if (!ctx) return;
    const wk = section.weeklyActivity || [];
    charts.activity = new Chart(ctx, {
      type: "line",
      data: {
        labels: wk.map((w) => w.label),
        datasets: [
          {
            label: "Alumnos activos",
            data: wk.map((w) => w.active),
            borderColor: C.brand,
            backgroundColor: "rgba(127,119,221,.12)",
            fill: true,
            tension: 0.35,
            yAxisID: "y",
            pointRadius: 3,
            pointBackgroundColor: C.brand,
          },
          {
            label: "Entregas",
            data: wk.map((w) => w.submissions),
            borderColor: C.amber,
            backgroundColor: "transparent",
            tension: 0.35,
            yAxisID: "y1",
            pointRadius: 3,
            pointBackgroundColor: C.amber,
            borderDash: [5, 4],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "bottom", labels: { font: baseFont(), boxWidth: 12, boxHeight: 12, usePointStyle: true } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: baseFont(), color: C.text } },
          y: { beginAtZero: true, position: "left", grid: { color: C.grid }, ticks: { font: baseFont(), color: C.text, precision: 0 }, title: { display: true, text: "Activos", font: baseFont(), color: C.text } },
          y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, ticks: { font: baseFont(), color: C.text }, title: { display: true, text: "Entregas", font: baseFont(), color: C.text } },
        },
      },
    });
  }

  // ─── Gráfico 4: comparativa entre secciones ─────────────────────────
  function renderCompareChart(activeId) {
    destroyChart("compare");
    const ctx = document.getElementById("compareChart");
    if (!ctx) return;
    const sections = Store.getSections();
    const labels = sections.map((s) => s.name.replace(/^[^·]+·\s*/, "").trim() || s.course);
    const values = sections.map((s) => Store.computeStats(s).avgAccuracy);
    const colors = sections.map((s) => (s.id === activeId ? C.brandDark : "rgba(127,119,221,.45)"));
    charts.compare = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{ label: "Aciertos promedio (%)", data: values, backgroundColor: colors, borderRadius: 5, maxBarThickness: 30 }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, max: 100, grid: { color: C.grid }, ticks: { font: baseFont(), color: C.text, callback: (v) => v + "%" } },
          y: { grid: { display: false }, ticks: { font: baseFont(), color: C.text } },
        },
      },
    });
  }

  // ─── Tabla de alumnos ───────────────────────────────────────────────
  function renderStudentsTable(list) {
    const body = document.getElementById("studentsTableBody");
    if (!body) return;
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="7" class="table-empty">No se encontraron alumnos.</td></tr>';
      return;
    }
    body.innerHTML = list
      .map((st, i) => {
        const liga = Common.ligaFor(st.xp || 0);
        const status = Common.statusFor(st);
        const accFill = st.accuracy >= 70 ? "" : st.accuracy >= 55 ? "amber" : "red";
        return `
      <tr data-student="${Common.escapeHtml(st.id)}" tabindex="0" role="button">
        <td>
          <div class="cell-user">
            <div class="cell-avatar" style="background:${Common.avatarColor(i)}">${Common.initials(st.name)}</div>
            <div>
              <div class="cell-name">${Common.escapeHtml(st.name)}</div>
              <div class="cell-sub">${liga.label}</div>
            </div>
          </div>
        </td>
        <td class="num">${Common.formatNumber(st.xp || 0)}</td>
        <td>
          <div class="cell-bar"><div class="track"><div class="fill ${accFill}" style="width:${st.accuracy || 0}%"></div></div><span class="pct">${st.accuracy || 0}%</span></div>
        </td>
        <td>
          <div class="cell-bar"><div class="track"><div class="fill teal" style="width:${st.completion || 0}%"></div></div><span class="pct">${st.completion || 0}%</span></div>
        </td>
        <td class="num">${st.simulacros || 0}</td>
        <td><span class="badge ${status.key}">${status.label}</span></td>
        <td class="num"><span class="row-go">Ver ›</span></td>
      </tr>`;
      })
      .join("");
  }

  // ─── Dashboard individual (modal) ───────────────────────────────────
  function openStudent(studentId) {
    const section = Store.getSection(currentSectionId);
    if (!section) return;
    const st = (section.students || []).find((s) => s.id === studentId);
    if (!st) return;

    const liga = Common.ligaFor(st.xp || 0);
    const status = Common.statusFor(st);

    const avatar = document.getElementById("studentAvatar");
    if (avatar) {
      avatar.textContent = Common.initials(st.name);
      avatar.style.background = Common.themeFor(section.course).chart;
      avatar.style.color = "#fff";
    }
    setText("modal-student-title", st.name);
    setText("studentSubtitle", `${section.name} · ${liga.label}`);

    const kpis = [
      { label: "XP total", value: Common.formatNumber(st.xp || 0) },
      { label: "Aciertos", value: (st.accuracy || 0) + "%" },
      { label: "Avance", value: (st.completion || 0) + "%" },
      { label: "Simulacros", value: st.simulacros || 0 },
    ];
    const kpiWrap = document.getElementById("studentKpis");
    if (kpiWrap) {
      kpiWrap.innerHTML = kpis
        .map((k) => `<div class="student-kpi"><div class="sk-value">${k.value}</div><div class="sk-label">${k.label}</div></div>`)
        .join("");
    }

    setText("studentChartSub", `Curso: ${section.course}`);

    // Detalle por tema (derivado de la precisión global del alumno)
    const topics = (section.topicPerformance || []).map((t) => t.topic);
    const scores = Common.topicScoresFor(st, topics);
    if (studentChart) studentChart.destroy();
    const ctx = document.getElementById("studentTopicChart");
    if (ctx) {
      studentChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: scores.map((s) => s.topic),
          datasets: [
            {
              label: "Aciertos (%)",
              data: scores.map((s) => s.score),
              backgroundColor: scores.map((s) => Common.performanceBand(s.score).color),
              borderRadius: 5,
              maxBarThickness: 22,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, max: 100, grid: { color: C.grid }, ticks: { font: baseFont(), color: C.text, callback: (v) => v + "%" } },
            y: { grid: { display: false }, ticks: { font: baseFont(), color: C.text } },
          },
        },
      });
    }

    const activity = document.getElementById("studentActivity");
    if (activity) {
      activity.innerHTML = `
        <div class="sa-row"><span class="badge ${status.key}">${status.label}</span>
          <span class="sa-text">Última actividad: ${Common.escapeHtml(st.activity || "—")}</span></div>
        <div class="sa-date">Conexión: ${Common.formatDate(st.lastActive)}</div>`;
    }

    UI.openModal("modal-student");
  }

  // ─── Render principal de la sección activa ──────────────────────────
  function renderSection(sectionId) {
    const section = Store.getSection(sectionId);
    if (!section) return;
    currentSectionId = sectionId;
    currentStudents = [...(section.students || [])].sort((a, b) => (b.xp || 0) - (a.xp || 0));
    const stats = Store.computeStats(section);

    const meta = document.getElementById("switcherMeta");
    if (meta) {
      meta.textContent = `${stats.students} alumnos · ${section.cycle || section.schedule || ""} · código ${section.joinCode}`;
    }

    renderKpis(stats);
    renderTopicChart(section);
    renderDistChart(stats);
    renderActivityChart(section);
    renderCompareChart(sectionId);
    renderStudentsTable(currentStudents);

    const reportsLink = document.getElementById("goReports");
    if (reportsLink) reportsLink.href = `reports.html?section=${encodeURIComponent(sectionId)}`;
  }

  // ─── Helpers ────────────────────────────────────────────────────────
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function populateSectionSelect(preferredId) {
    const select = document.getElementById("sectionSelect");
    if (!select) return null;
    const sections = Store.getSections();
    select.innerHTML = sections
      .map((s) => `<option value="${Common.escapeHtml(s.id)}">${Common.escapeHtml(s.name)}</option>`)
      .join("");
    const chosen = sections.some((s) => s.id === preferredId) ? preferredId : sections[0] && sections[0].id;
    if (chosen) select.value = chosen;
    return chosen;
  }

  // ─── Wiring ─────────────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById("sectionSelect")?.addEventListener("change", (e) => {
      renderSection(e.target.value);
    });

    // Búsqueda en la tabla
    document.getElementById("studentTableSearch")?.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      renderStudentsTable(currentStudents.filter((s) => s.name.toLowerCase().includes(q)));
    });

    // Drill-down: click / Enter en una fila de alumno
    document.getElementById("studentsTableBody")?.addEventListener("click", (e) => {
      const row = e.target.closest("[data-student]");
      if (row) openStudent(row.dataset.student);
    });
    document.getElementById("studentsTableBody")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const row = e.target.closest("[data-student]");
      if (row) {
        e.preventDefault();
        openStudent(row.dataset.student);
      }
    });

    UI.wireModal("modal-student");
  }

  // ─── Init ───────────────────────────────────────────────────────────
  async function init() {
    if (!Store || !Common || !UI) {
      console.error("[analytics] Dependencias del panel docente no cargadas.");
      return;
    }
    if (typeof Chart === "undefined") {
      console.error("[analytics] Chart.js no está disponible.");
    }

    if (window.CurrentUserService && typeof CurrentUserService.init === 'function') {
        await CurrentUserService.init();
    }
    await Store.init();
    const sections = Store.getSections();

    if (!sections.length) {
      document.getElementById("analyticsBody")?.classList.add("hidden");
      document.querySelector(".section-switcher")?.classList.add("hidden");
      document.getElementById("analyticsEmpty")?.classList.remove("hidden");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const chosen = populateSectionSelect(params.get("section"));
    bindEvents();
    if (chosen) renderSection(chosen);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
