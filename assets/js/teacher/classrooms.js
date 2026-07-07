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
      <div class="activity-row" style="cursor: pointer; transition: transform 0.2s; position: relative;" onclick="window.openGradingModal('${act.id}', '${Common.escapeHtml(act.title.replace(/'/g, "\\'"))}')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
        <div class="activity-ico">${meta.icon}</div>
        <div class="activity-main">
          <div class="activity-title">${Common.escapeHtml(act.title)}</div>
          <div class="activity-sub">${due}${topic}</div>
        </div>
        <span class="badge ${act.type}">${meta.label}</span>
        <span class="activity-points">${act.points ? `+${act.points} XP` : ""}</span>
        <button class="activity-del" data-del-activity="${act.id}" aria-label="Eliminar actividad" title="Eliminar" onclick="event.stopPropagation();">
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

  async function handleCreateSection(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(sectionForm).entries());
    
    const result = await Store.createSection(data);

    if (!result.ok) {
      if (result.errors.server) {
        UI.toast(result.errors.server, "error");
      }
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

    const quizContainer = document.getElementById("quiz-builder-container");
    if (quizContainer) {
      if (type === "quiz") {
        quizContainer.classList.remove("hidden");
        // Asegurarnos que haya al menos una pregunta al abrir
        if (document.getElementById("quiz-questions-list").children.length === 0) {
          addQuizQuestion();
        }
      } else {
        quizContainer.classList.add("hidden");
      }
    }
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

  async function handleCreateActivity(e) {
    e.preventDefault();
    if (!currentSectionId) return;
    const data = Object.fromEntries(new FormData(activityForm).entries());
    
    const result = await Store.addActivity(currentSectionId, data);

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

  // ─── Quiz Builder Lógica ─────────────────────────────────────────────
  let questionCount = 0;
  function addQuizQuestion() {
    questionCount++;
    const list = document.getElementById("quiz-questions-list");
    if (!list) return;

    const qDiv = document.createElement("div");
    qDiv.className = "quiz-question-item";
    qDiv.style = "background: #fdfdfd; border: 1px solid var(--border); border-radius: 8px; padding: 12px;";
    qDiv.innerHTML = `
      <div style="display:flex; justify-content: space-between; margin-bottom: 8px;">
        <label style="font-size: 13px; font-weight: 600;">Pregunta ${questionCount}</label>
        <button type="button" class="btn-remove-q" style="background:none; border:none; color:var(--red-err); cursor:pointer; font-size:12px;">Eliminar</button>
      </div>
      <input type="text" name="q_${questionCount}_text" placeholder="Escribe la pregunta..." required style="width:100%; margin-bottom:8px; padding:8px; border:1px solid var(--border); border-radius:4px;">
      <div class="quiz-options-grid">
        <div style="display:flex; align-items:center; gap:4px;">
          <input type="radio" name="q_${questionCount}_correct" value="0" required>
          <input type="text" name="q_${questionCount}_opt0" placeholder="Opción 1" required style="width:100%; padding:6px; border:1px solid var(--border); border-radius:4px;">
        </div>
        <div style="display:flex; align-items:center; gap:4px;">
          <input type="radio" name="q_${questionCount}_correct" value="1">
          <input type="text" name="q_${questionCount}_opt1" placeholder="Opción 2" required style="width:100%; padding:6px; border:1px solid var(--border); border-radius:4px;">
        </div>
        <div style="display:flex; align-items:center; gap:4px;">
          <input type="radio" name="q_${questionCount}_correct" value="2">
          <input type="text" name="q_${questionCount}_opt2" placeholder="Opción 3" required style="width:100%; padding:6px; border:1px solid var(--border); border-radius:4px;">
        </div>
        <div style="display:flex; align-items:center; gap:4px;">
          <input type="radio" name="q_${questionCount}_correct" value="3">
          <input type="text" name="q_${questionCount}_opt3" placeholder="Opción 4" required style="width:100%; padding:6px; border:1px solid var(--border); border-radius:4px;">
        </div>
      </div>
    `;
    qDiv.querySelector(".btn-remove-q").addEventListener("click", () => {
      qDiv.remove();
    });
    list.appendChild(qDiv);
  }

  // ─── Material Selector Lógica ────────────────────────────────────────
  let materialsCache = [];
  
  async function loadMaterials() {
    try {
      const res = await fetch("../../mock/resources.json");
      materialsCache = await res.json();
    } catch (e) {
      console.error("Error loading resources:", e);
    }
  }

  function renderMaterialList(query = "") {
    const container = document.getElementById("material-list-container");
    if (!container) return;
    
    const lowerQ = query.toLowerCase();
    const filtered = materialsCache.filter(m => 
      m.title.toLowerCase().includes(lowerQ) || 
      (m.topicId && m.topicId.toLowerCase().includes(lowerQ))
    ).slice(0, 15); // limit to 15 for performance

    if (filtered.length === 0) {
      container.innerHTML = '<div style="padding:10px; text-align:center; color:var(--sub); font-size:13px;">No se encontraron materiales.</div>';
      return;
    }

    container.innerHTML = filtered.map(m => `
      <div style="padding: 10px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: space-between;" class="material-item-row" data-id="${m.id}" data-title="${Common.escapeHtml(m.title)}">
        <div>
          <div style="font-weight: 600; font-size: 13px;">${Common.escapeHtml(m.title)}</div>
          <div style="font-size: 11px; color: var(--sub);">${m.type.toUpperCase()} · ${m.courseId}</div>
        </div>
        <button type="button" class="btn btn-sm btn-line" style="pointer-events: none;">Seleccionar</button>
      </div>
    `).join("");

    container.querySelectorAll(".material-item-row").forEach(row => {
      row.addEventListener("click", () => {
        selectMaterial(row.dataset.id, row.dataset.title);
      });
    });
  }

  function selectMaterial(id, title) {
    document.getElementById("linkedMaterialId").value = id;
    document.getElementById("selected-material-title").textContent = title;
    document.getElementById("selected-material-display").style.display = "block";
    UI.closeModal("modal-material-selector");
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

    // Quiz Builder y Material Selector
    document.getElementById("btnAddQuestion")?.addEventListener("click", addQuizQuestion);
    
    document.getElementById("btnOpenMaterialSelector")?.addEventListener("click", () => {
      UI.openModal("modal-material-selector");
      if (materialsCache.length === 0) {
        loadMaterials().then(() => renderMaterialList(""));
      } else {
        renderMaterialList(document.getElementById("materialSearch")?.value || "");
      }
    });

    document.getElementById("materialSearch")?.addEventListener("input", (e) => {
      renderMaterialList(e.target.value);
    });

    document.getElementById("btnRemoveMaterial")?.addEventListener("click", () => {
      document.getElementById("linkedMaterialId").value = "";
      document.getElementById("selected-material-display").style.display = "none";
    });

    // Eliminar actividad (delegación en la lista)
    document.getElementById("activitiesList")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-del-activity]");
      if (!btn || !currentSectionId) return;
      if (await Store.removeActivity(currentSectionId, btn.dataset.delActivity)) {
        renderActivities(Store.getSection(currentSectionId));
        UI.toast("Actividad eliminada", "info");
      }
    });

    // ==========================================
    // LÓGICA DE CALIFICACIÓN (MODAL CENTRAL)
    // ==========================================

    window.openGradingModal = async (activityId, activityTitle) => {
      document.getElementById('grading-header-content').innerHTML = `
        <span style="font-size: 11px; background: rgba(255,255,255,0.5); padding: 4px 8px; border-radius: 4px; color: var(--brand); font-weight: 700;">CALIFICACIÓN</span>
        <h2 style="font-size: 24px; font-weight: 800; margin-top: 8px; color: var(--dark);">${activityTitle}</h2>
      `;
      
      const listEl = document.getElementById('grading-submissions-list');
      const countEl = document.getElementById('grading-submissions-count');
      
      listEl.innerHTML = '<div style="padding: 20px; text-align: center;">Cargando entregas...</div>';
      countEl.textContent = '...';
      
      document.getElementById('grading-center-modal').classList.add('open');
      document.body.style.overflow = 'hidden';

      try {
        const { data: submissions, error } = await window.supabase
          .from('activity_submissions')
          .select('id, content, score, feedback, status, submitted_at, profiles:student_id(name)')
          .eq('activity_id', activityId)
          .order('submitted_at', { ascending: false });

        if (error) throw error;

        countEl.textContent = submissions.length;

        if (submissions.length === 0) {
          listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--sub);">Aún no hay entregas para esta tarea.</div>';
          return;
        }

        listEl.innerHTML = submissions.map(sub => {
          const studentName = sub.profiles?.name || 'Alumno Anónimo';
          const isGraded = sub.status === 'graded' || sub.status === 'returned';
          const badgeHtml = isGraded 
            ? `<span style="font-size:12px; background:var(--green-soft); color:var(--green); padding:4px 8px; border-radius:12px; font-weight:600;">Calificado</span>`
            : `<span style="font-size:12px; background:var(--amber-soft); color:var(--amber); padding:4px 8px; border-radius:12px; font-weight:600;">Pendiente</span>`;

          const contentIsLink = sub.content && (sub.content.startsWith('http://') || sub.content.startsWith('https://'));
          const displayContent = contentIsLink 
            ? `<a href="${sub.content}" target="_blank" style="color:var(--brand); text-decoration:underline;">Abrir enlace adjunto ↗</a>`
            : Common.escapeHtml(sub.content || 'Sin contenido');

          return `
            <div class="grading-row">
              <div class="grading-row-header">
                <div class="grading-student-name">${Common.escapeHtml(studentName)}</div>
                <div>${badgeHtml} <span style="font-size:12px; color:var(--sub); margin-left:8px;">Entregado: ${Common.formatDate(sub.submitted_at)}</span></div>
              </div>
              <div class="grading-content-box">
                ${displayContent}
              </div>
              <div class="grading-inputs">
                <div class="grading-input-group">
                  <label>Nota (0-100)</label>
                  <input type="number" id="score-${sub.id}" value="${sub.score || ''}" placeholder="Ej. 85" min="0" max="100">
                </div>
                <div class="grading-input-group">
                  <label>Retroalimentación</label>
                  <input type="text" id="feedback-${sub.id}" value="${sub.feedback || ''}" placeholder="Buen trabajo, pero faltó...">
                </div>
                <div>
                  <button class="btn btn-primary" onclick="window.saveGrade('${sub.id}', '${activityId}')">Guardar</button>
                </div>
              </div>
            </div>
          `;
        }).join('');

      } catch (err) {
        console.error("Error al cargar entregas:", err);
        listEl.innerHTML = '<div style="color:red; padding:20px;">Error al cargar las entregas.</div>';
      }
    };

    window.closeGradingModal = () => {
      document.getElementById('grading-center-modal').classList.remove('open');
      document.body.style.overflow = '';
    };

    window.saveGrade = async (submissionId, activityId) => {
      const scoreInput = document.getElementById(`score-${submissionId}`);
      const feedbackInput = document.getElementById(`feedback-${submissionId}`);
      
      let score = parseInt(scoreInput.value);
      if (isNaN(score) || score < 0 || score > 100) {
        UI.toast("La nota debe ser un número entre 0 y 100", "error");
        return;
      }
      
      const btn = event.currentTarget;
      const originalText = btn.textContent;
      btn.textContent = 'Guardando...';
      btn.disabled = true;

      try {
        const { error } = await window.supabase
          .from('activity_submissions')
          .update({
            score: score,
            feedback: feedbackInput.value || null,
            status: 'graded'
          })
          .eq('id', submissionId);

        if (error) throw error;

        UI.toast("Calificación guardada", "success");
        // No cerramos el modal, solo repintamos (opcionalmente) o marcamos el badge localmente
        btn.textContent = 'Guardado ✓';
        btn.style.background = 'var(--green)';
        btn.style.borderColor = 'var(--green)';
        
        setTimeout(() => {
          btn.textContent = 'Guardar';
          btn.style.background = '';
          btn.style.borderColor = '';
          btn.disabled = false;
        }, 2000);

      } catch (err) {
        console.error("Error al guardar calificación:", err);
        UI.toast("Error al guardar", "error");
        btn.textContent = originalText;
        btn.disabled = false;
      }
    };

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
    
    if (window.CurrentUserService && !CurrentUserService.getProfile()) {
      await CurrentUserService.init();
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
