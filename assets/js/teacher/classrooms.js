// ==========================================================================
// assets/js/teacher/classrooms.js
// SECCIONES DEL DOCENTE — listado, creación, detalle y actividades
// Datos vía window.TeacherStore · helpers vía window.TeacherCommon
// ==========================================================================

(function () {
  "use strict";

  const Common = window.TeacherCommon;
  const Store = window.TeacherStore;
  const UI = window.TeacherUI;

  // Estado de la vista
  let currentFilter = "todas";
  let currentSectionId = null;
  let currentRest = []; // alumnos fuera del podio (para la búsqueda)

  // Nodos cacheados
  const sectionGrid = document.getElementById("sectionGrid");
  const sectionsEmpty = document.getElementById("sectionsEmpty");
  const filterChips = document.getElementById("filterChips");
  const screenSelect = document.getElementById("screen-select");
  const screenDetail = document.getElementById("screen-detail");

  // ─── Render: chips de filtro ────────────────────────────────────────
  function renderFilterChips() {
    if (!filterChips) return;
    const courses = [...new Set(Store.getSections().map((s) => s.course))];
    const chips = ['<button class="chip active" data-course="todas">Todas</button>'];
    courses.forEach((course) => {
      chips.push(
        `<button class="chip" data-course="${Common.escapeHtml(course)}">${Common.escapeHtml(course)}</button>`
      );
    });
    filterChips.innerHTML = chips.join("");
  }

  // ─── Render: tarjetas de sección ────────────────────────────────────
  function renderSectionGrid() {
    if (!sectionGrid) return;
    const all = Store.getSections();

    if (all.length === 0) {
      sectionGrid.innerHTML = "";
      filterChips.classList.add("hidden");
      sectionsEmpty.classList.remove("hidden");
      return;
    }
    filterChips.classList.remove("hidden");
    sectionsEmpty.classList.add("hidden");

    const visible = all.filter((s) => currentFilter === "todas" || s.course === currentFilter);
    sectionGrid.innerHTML = "";

    visible.forEach((section) => {
      const theme = Common.themeFor(section.course);
      const stats = Store.computeStats(section);
      const students = section.students || [];

      const stack = students
        .slice(0, 3)
        .map(
          (st, i) =>
            `<div class="mini-avatar" style="background:${Common.avatarColor(i)}">${Common.initials(st.name)}</div>`
        )
        .join("");
      const moreCount = Math.max(0, stats.students - 3);
      const moreLabel =
        stats.students === 0
          ? '<span class="more">Sin alumnos aún</span>'
          : moreCount > 0
          ? `<span class="more">+${moreCount} alumnos</span>`
          : `<span class="more">${stats.students} alumnos</span>`;

      const subtitle = `${stats.students} alumnos · ${Common.escapeHtml(section.cycle || section.schedule || "Sin horario")}`;

      const card = document.createElement("div");
      card.className = "section-card";
      card.innerHTML = `
        <div class="course-icon-chip" style="background:${theme.soft};color:${theme.color}">${Common.iconFor(section.course)}</div>
        <h4>${Common.escapeHtml(section.name)}</h4>
        <div class="course-tag">${subtitle}</div>
        <div class="section-card-stats">
          <div class="stat"><div class="num">${stats.students}</div><div class="lbl">Alumnos</div></div>
          <div class="stat"><div class="num">${Common.formatNumber(stats.avgXp)}</div><div class="lbl">XP promedio</div></div>
          <div class="stat"><div class="num">${stats.activity}%</div><div class="lbl">Actividad</div></div>
        </div>
        <div class="avatar-stack">${stack}${moreLabel}</div>
        <div class="enter-row">Ver actividad
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      `;
      card.addEventListener("click", () => openSection(section.id));
      sectionGrid.appendChild(card);
    });
  }

  // ─── Detalle de sección ─────────────────────────────────────────────
  function openSection(id) {
    const section = Store.getSection(id);
    if (!section) return;
    currentSectionId = id;

    const theme = Common.themeFor(section.course);
    const stats = Store.computeStats(section);

    const iconChip = document.getElementById("detailIconChip");
    if (iconChip) {
      iconChip.style.background = theme.soft;
      iconChip.style.color = theme.color;
      iconChip.innerHTML = Common.iconFor(section.course);
    }

    setText("detailTitle", section.name);
    setText(
      "detailSubtitle",
      [section.cycle, section.shift, section.schedule].filter(Boolean).join(" · ") || "Sin horario asignado"
    );
    setText("detailJoinValue", section.joinCode || "—");
    setText("detailAvgXp", Common.formatNumber(stats.avgXp) + " XP");
    setText("detailActivity", stats.activity + "%");
    setText("detailCount", stats.students);

    const dashLink = document.getElementById("detailDashboardLink");
    if (dashLink) dashLink.href = `analytics.html?section=${encodeURIComponent(id)}`;

    renderActivities(section);
    renderRanking(section);

    if (screenSelect) screenSelect.classList.add("hidden");
    if (screenDetail) screenDetail.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ─── Ranking (podio + lista) ────────────────────────────────────────
  function renderRanking(section) {
    const students = [...(section.students || [])].sort((a, b) => (b.xp || 0) - (a.xp || 0));
    const podium = document.getElementById("podium");
    const rankList = document.getElementById("rankList");
    const search = document.getElementById("studentSearch");
    if (search) search.value = "";

    if (students.length === 0) {
      if (podium) podium.innerHTML = "";
      if (rankList) {
        rankList.innerHTML =
          '<div class="empty-row">Esta sección todavía no tiene alumnos inscritos. Comparte el código de unión para que se sumen.</div>';
      }
      currentRest = [];
      return;
    }

    const top3 = students.slice(0, 3);
    currentRest = students.slice(3);
    const medalCls = ["gold", "silver", "bronze"];

    if (podium) {
      podium.innerHTML = top3
        .map((st, i) => {
          const liga = Common.ligaFor(st.xp || 0);
          return `
        <div class="podium-card rank-${i + 1}">
          <div class="medal ${medalCls[i]}">${i + 1}</div>
          <div class="podium-avatar" style="background:${Common.avatarColor(i)}">${Common.initials(st.name)}</div>
          <div class="podium-name">${Common.escapeHtml(st.name)}</div>
          <div class="podium-xp">${Common.formatNumber(st.xp || 0)} <span>XP</span></div>
          <div class="podium-liga rank-liga ${liga.cls}">${liga.label}</div>
        </div>`;
        })
        .join("");
    }
    renderRestList(currentRest);
  }

  function renderRestList(list) {
    const rankList = document.getElementById("rankList");
    if (!rankList) return;
    if (list.length === 0) {
      rankList.innerHTML = '<div class="empty-row">No se encontraron alumnos con ese nombre.</div>';
      return;
    }
    rankList.innerHTML = list
      .map((st, i) => {
        const liga = Common.ligaFor(st.xp || 0);
        return `
      <div class="rank-row">
        <div class="rank-num">${i + 4}</div>
        <div class="rank-avatar" style="background:${Common.avatarColor(i + 3)}">${Common.initials(st.name)}</div>
        <div>
          <div class="rank-name">${Common.escapeHtml(st.name)}</div>
          <div class="rank-activity">${Common.escapeHtml(st.activity || "")}</div>
        </div>
        <div class="rank-liga ${liga.cls}">${liga.label}</div>
        <div class="rank-xp">${Common.formatNumber(st.xp || 0)}<span>XP</span></div>
      </div>`;
      })
      .join("");
  }

  // ─── Actividades (tareas / retos / quizzes) ─────────────────────────
  function renderActivities(section) {
    const list = document.getElementById("activitiesList");
    const count = document.getElementById("activitiesCount");
    const activities = section.activities || [];
    if (count) count.textContent = activities.length ? `${activities.length}` : "";
    if (!list) return;

    if (activities.length === 0) {
      list.innerHTML =
        '<div class="empty-row">Aún no has asignado actividades. Usa “Asignar tarea”, “Crear reto” o “Crear quiz”.</div>';
      return;
    }

    list.innerHTML = activities
      .map((act) => {
        const meta = Common.ACTIVITY_TYPES[act.type] || { label: act.type, icon: "•" };
        const due = act.dueDate ? `Entrega ${Common.formatDate(act.dueDate)}` : "Sin fecha límite";
        const topic = act.topic ? ` · ${Common.escapeHtml(act.topic)}` : "";
        return `
      <div class="activity-row">
        <div class="activity-ico">${meta.icon}</div>
        <div class="activity-main">
          <div class="activity-title">${Common.escapeHtml(act.title)}</div>
          <div class="activity-sub">${due}${topic}</div>
        </div>
        <span class="badge ${act.type}">${meta.label}</span>
        <span class="activity-points">${act.points ? `+${act.points} XP` : ""}</span>
        <button class="activity-del" data-del-activity="${act.id}" aria-label="Eliminar actividad" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>`;
      })
      .join("");
  }

  // ─── Modal: crear sección ───────────────────────────────────────────
  const sectionForm = document.getElementById("sectionForm");

  function populateCourseSelect() {
    const select = document.getElementById("sec-course");
    if (!select) return;
    Common.COURSE_LIST.forEach((course) => {
      const opt = document.createElement("option");
      opt.value = course;
      opt.textContent = course;
      select.appendChild(opt);
    });
  }

  function openCreateSection() {
    if (sectionForm) {
      sectionForm.reset();
      UI.clearFieldErrors(sectionForm);
    }
    UI.openModal("modal-section");
  }

  function handleCreateSection(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(sectionForm).entries());
    const result = Store.createSection(data);

    if (!result.ok) {
      UI.showFieldErrors(sectionForm, result.errors);
      return;
    }

    UI.closeModal("modal-section");
    UI.toast(`Sección “${result.section.name}” creada · código ${result.section.joinCode}`);

    currentFilter = "todas";
    renderFilterChips();
    renderSectionGrid();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ─── Modal: actividad ───────────────────────────────────────────────
  const activityForm = document.getElementById("activityForm");
  const activityTypeInput = document.getElementById("activityType");

  function selectActivityType(type) {
    if (activityTypeInput) activityTypeInput.value = type;
    document.querySelectorAll("#activityTypePicker .type-option").forEach((opt) => {
      opt.classList.toggle("active", opt.dataset.type === type);
    });
    const meta = Common.ACTIVITY_TYPES[type] || { verb: "Asignar actividad" };
    setText("modal-activity-title", meta.verb);
    const submit = document.getElementById("activitySubmit");
    if (submit) submit.textContent = type === "tarea" ? "Asignar" : "Crear";
    const icon = document.getElementById("activityIcon");
    if (icon) icon.className = "tmodal-icon " + (type === "quiz" ? "" : "amber");
  }

  function openActivityModal(type) {
    if (!currentSectionId) return;
    const section = Store.getSection(currentSectionId);
    if (!section) return;
    if (activityForm) {
      activityForm.reset();
      UI.clearFieldErrors(activityForm);
    }
    selectActivityType(type || "tarea");
    setText("activitySectionName", section.name);
    UI.openModal("modal-activity");
  }

  function handleCreateActivity(e) {
    e.preventDefault();
    if (!currentSectionId) return;
    const data = Object.fromEntries(new FormData(activityForm).entries());
    const result = Store.addActivity(currentSectionId, data);

    if (!result.ok) {
      UI.showFieldErrors(activityForm, result.errors);
      return;
    }
    UI.closeModal("modal-activity");
    const meta = Common.ACTIVITY_TYPES[result.activity.type] || { label: "Actividad" };
    UI.toast(`${meta.label} “${result.activity.title}” asignada a la sección`);

    const section = Store.getSection(currentSectionId);
    renderActivities(section);
  }

  // ─── Helpers ────────────────────────────────────────────────────────
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  // ─── Wiring de eventos ──────────────────────────────────────────────
  function bindEvents() {
    // Chips de filtro (delegación)
    if (filterChips) {
      filterChips.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        filterChips.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        currentFilter = chip.dataset.course;
        renderSectionGrid();
      });
    }

    // Abrir modal crear sección
    document.getElementById("openCreateSection")?.addEventListener("click", openCreateSection);
    document.getElementById("openCreateSectionEmpty")?.addEventListener("click", openCreateSection);
    if (sectionForm) sectionForm.addEventListener("submit", handleCreateSection);

    // Volver al listado
    document.getElementById("backLink")?.addEventListener("click", () => {
      if (screenDetail) screenDetail.classList.add("hidden");
      if (screenSelect) screenSelect.classList.remove("hidden");
      renderSectionGrid();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Botones de nueva actividad (detalle)
    document.querySelectorAll("[data-new-activity]").forEach((btn) => {
      btn.addEventListener("click", () => openActivityModal(btn.dataset.newActivity));
    });
    if (activityForm) activityForm.addEventListener("submit", handleCreateActivity);
    document.querySelectorAll("#activityTypePicker .type-option").forEach((opt) => {
      opt.addEventListener("click", () => selectActivityType(opt.dataset.type));
    });

    // Eliminar actividad (delegación en la lista)
    document.getElementById("activitiesList")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-del-activity]");
      if (!btn || !currentSectionId) return;
      if (Store.removeActivity(currentSectionId, btn.dataset.delActivity)) {
        renderActivities(Store.getSection(currentSectionId));
        UI.toast("Actividad eliminada", "info");
      }
    });

    // Copiar código de unión
    document.getElementById("copyJoinCode")?.addEventListener("click", async () => {
      const code = document.getElementById("detailJoinValue")?.textContent || "";
      const ok = await UI.copy(code);
      UI.toast(ok ? `Código ${code} copiado` : "No se pudo copiar el código", ok ? "success" : "info");
    });

    // Búsqueda de alumnos
    document.getElementById("studentSearch")?.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      renderRestList(currentRest.filter((st) => st.name.toLowerCase().includes(q)));
    });

    // Tabs de periodo (estado visual)
    document.querySelectorAll(".toolbar-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".toolbar-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
      });
    });

    // Modales: cerrar por backdrop / botones
    UI.wireModal("modal-section");
    UI.wireModal("modal-activity");
  }

  // ─── Init ───────────────────────────────────────────────────────────
  async function init() {
    if (!Store || !Common || !UI) {
      console.error("[classrooms] Dependencias del panel docente no cargadas.");
      return;
    }
    await Store.init();
    populateCourseSelect();
    renderFilterChips();
    renderSectionGrid();
    bindEvents();

    // Deep-link: ?section=ID abre el detalle; ?create=1 abre el modal.
    const params = new URLSearchParams(window.location.search);
    const target = params.get("section");
    if (target && Store.getSection(target)) {
      openSection(target);
    } else if (params.get("create") === "1") {
      openCreateSection();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
