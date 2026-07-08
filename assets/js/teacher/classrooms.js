// ==========================================================================
// assets/js/teacher/classrooms.js
// SECCIONES DEL DOCENTE — listado, creación, detalle y actividades
// Datos vía Supabase · helpers vía window.TeacherCommon
// ==========================================================================

(function () {
  "use strict";

  const Common = window.TeacherCommon;
  const UI = window.TeacherUI;

  // Estado de la vista
  let currentFilter = "todas";
  let currentSectionId = null;
  let currentRest = []; // alumnos fuera del podio (para la búsqueda)
  let _assignMode = false;
  let teacherSections = [];

  // Nodos cacheados
  const sectionGrid = document.getElementById("sectionGrid");
  const sectionsEmpty = document.getElementById("sectionsEmpty");
  const filterChips = document.getElementById("filterChips");
  const screenSelect = document.getElementById("screen-select");
  const screenDetail = document.getElementById("screen-detail");
  const sectionForm = document.getElementById("sectionForm");
  const activityForm = document.getElementById("activityForm");
  const activityTypeInput = document.getElementById("activityType");
  const addStudentForm = document.getElementById("addStudentForm");

  function getSupabase() {
    return window.supabase || null;
  }

  function getTeacherId() {
    return window.CurrentUserService?.getProfile()?.id || null;
  }

  function getSection(id) {
    return teacherSections.find((s) => s.id === id) || null;
  }

  async function loadTeacherSections() {
    const supabase = getSupabase();
    const teacherId = getTeacherId();
    if (!supabase || !teacherId) return [];

    const { data: classrooms, error } = await supabase
      .from("classrooms")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[classrooms] Error cargando aulas:", error);
      return [];
    }

    if (!classrooms || classrooms.length === 0) {
      teacherSections = [];
      return [];
    }

    const ids = classrooms.map((c) => c.id);
    const [{ data: enrollments }, { data: activities }, { data: classStats }] = await Promise.all([
      supabase.from("classroom_students").select("classroom_id, student_id, joined_at").in("classroom_id", ids),
      supabase.from("classroom_activities").select("*").in("classroom_id", ids),
      supabase.from("classroom_student_stats").select("classroom_id, student_id, total_xp, accuracy, completion, simulacros, last_active").in("classroom_id", ids),
    ]);

    const studentIds = [...new Set((enrollments || []).map((e) => e.student_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, avatar_url, total_xp, last_problem_solved_at")
      .in("id", studentIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const statsByClass = new Map();
    (classStats || []).forEach((s) => {
      let m = statsByClass.get(s.classroom_id);
      if (!m) {
        m = new Map();
        statsByClass.set(s.classroom_id, m);
      }
      m.set(s.student_id, s);
    });

    const enrByClass = {};
    (enrollments || []).forEach((e) => {
      if (!enrByClass[e.classroom_id]) enrByClass[e.classroom_id] = [];
      enrByClass[e.classroom_id].push(e);
    });

    const actByClass = {};
    (activities || []).forEach((a) => {
      if (!actByClass[a.classroom_id]) actByClass[a.classroom_id] = [];
      actByClass[a.classroom_id].push(a);
    });

    teacherSections = classrooms.map((c) => {
      const enrs = enrByClass[c.id] || [];
      const statsMap = statsByClass.get(c.id) || new Map();
      const students = enrs
        .map((e) => {
          const p = profileMap.get(e.student_id) || {};
          const stats = statsMap.get(e.student_id) || {};
          const lastActive = stats.last_active || p.last_problem_solved_at || e.joined_at;
          return {
            id: p.id || e.student_id,
            name: p.name || "Estudiante",
            avatar_url: p.avatar_url,
            xp: stats.total_xp ?? p.total_xp ?? 0,
            accuracy: stats.accuracy ?? 0,
            completion: stats.completion ?? 0,
            simulacros: stats.simulacros ?? 0,
            lastActive,
            activity: Common.statusFor({ lastActive }).label,
          };
        })
        .sort((a, b) => (b.xp || 0) - (a.xp || 0));

      const activitiesList = (actByClass[c.id] || []).map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        topic: a.topic,
        dueDate: a.due_date,
        points: a.points,
        createdAt: a.created_at,
      }));

      return {
        id: c.id,
        name: c.name,
        course: c.course,
        cycle: c.cycle,
        shift: c.shift,
        schedule: c.schedule,
        joinCode: c.join_code,
        capacity: c.capacity,
        description: c.description,
        createdAt: c.created_at,
        students,
        activities: activitiesList,
      };
    });

    return teacherSections;
  }

  function computeStats(section) {
    const students = (section && section.students) || [];
    const count = students.length;
    if (!count) {
      return { students: 0, avgXp: 0, activity: 0, topPerformer: null };
    }
    const sumXp = students.reduce((acc, st) => acc + (st.xp || 0), 0);
    const active = students.filter((st) => Common.daysSince(st.lastActive) <= 7).length;
    const top = [...students].sort((a, b) => (b.xp || 0) - (a.xp || 0))[0];
    return {
      students: count,
      avgXp: Math.round(sumXp / count),
      activity: Math.round((active / count) * 100),
      topPerformer: top,
    };
  }

  // ─── Render: chips de filtro ────────────────────────────────────────
  function renderFilterChips() {
    if (!filterChips) return;
    const courses = [...new Set(teacherSections.map((s) => s.course).filter(Boolean))];
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
    const all = teacherSections;

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
      const stats = computeStats(section);
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
      card.addEventListener("click", () => {
        if (_assignMode) openAssignActivityModal(section.id);
        else openSection(section.id);
      });
      sectionGrid.appendChild(card);
    });
  }

  // ─── Detalle de sección ─────────────────────────────────────────────
  function openSection(id) {
    const section = getSection(id);
    if (!section) return;
    currentSectionId = id;

    const theme = Common.themeFor(section.course);
    const stats = computeStats(section);

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

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 24);
  }

  function randomToken(len) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < len; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  function generateClassroomId() {
    return `cls_${Date.now().toString(36)}_${randomToken(4).toLowerCase()}`;
  }

  async function generateJoinCode(course) {
    const supabase = getSupabase();
    const prefix = slugify(course).replace(/-/g, "").slice(0, 3).toUpperCase() || "AUL";
    let code;
    for (let attempt = 0; attempt < 10; attempt++) {
      code = `${prefix}-${randomToken(4)}`;
      const { data } = await supabase
        .from("classrooms")
        .select("join_code")
        .eq("join_code", code)
        .maybeSingle();
      if (!data) break; // libre
    }
    return code;
  }

  function validateSection(payload) {
    const errors = {};
    const name = (payload.name || "").trim();
    const course = (payload.course || "").trim();

    if (!course) errors.course = "Selecciona un curso.";
    if (!name) {
      errors.name = "Ponle un nombre a la sección.";
    } else if (name.length < 3) {
      errors.name = "El nombre es demasiado corto.";
    } else {
      const dup = teacherSections.some(
        (s) => s.name.trim().toLowerCase() === name.toLowerCase()
      );
      if (dup) errors.name = "Ya tienes una sección con ese nombre.";
    }

    if (payload.capacity != null && payload.capacity !== "") {
      const cap = Number(payload.capacity);
      if (!Number.isInteger(cap) || cap < 1 || cap > 300) {
        errors.capacity = "La capacidad debe estar entre 1 y 300.";
      }
    }
    return errors;
  }

  function validateActivity(payload) {
    const errors = {};
    if (!payload.type || !["tarea", "reto", "quiz"].includes(payload.type)) {
      errors.type = "Tipo de actividad inválido.";
    }
    if (!(payload.title || "").trim()) {
      errors.title = "Escribe un título.";
    }
    if (payload.points != null && payload.points !== "") {
      const pts = Number(payload.points);
      if (!Number.isInteger(pts) || pts < 0 || pts > 1000) {
        errors.points = "Los puntos deben estar entre 0 y 1000.";
      }
    }
    if (payload.dueDate) {
      const d = new Date(payload.dueDate);
      if (Number.isNaN(d.getTime())) errors.dueDate = "Fecha inválida.";
    }
    return errors;
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
    const errors = validateSection(data);

    if (Object.keys(errors).length) {
      UI.showFieldErrors(sectionForm, errors);
      return;
    }

    const supabase = getSupabase();
    const teacherId = getTeacherId();
    const id = generateClassroomId();

    let joinCode;
    let insertError;
    for (let attempt = 0; attempt < 5; attempt++) {
      joinCode = await generateJoinCode(data.course);
      const { error } = await supabase.from("classrooms").insert({
        id,
        teacher_id: teacherId,
        name: data.name.trim(),
        course: data.course,
        cycle: data.cycle || null,
        shift: data.shift || null,
        schedule: data.schedule || null,
        capacity: data.capacity ? Number(data.capacity) : null,
        description: data.description || null,
        join_code: joinCode,
      });
      if (!error) {
        insertError = null;
        break;
      }
      insertError = error;
      // Si el código de unión ya existe, reintentar con otro
      if (error.code !== "23505") break;
    }

    if (insertError) {
      UI.showFieldErrors(sectionForm, { name: insertError.message });
      return;
    }

    UI.closeModal("modal-section");
    UI.toast(`Sección creada · código ${joinCode}`);

    currentFilter = "todas";
    await loadTeacherSections();
    renderFilterChips();
    renderSectionGrid();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ─── Modal: actividad ───────────────────────────────────────────────
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
    const section = getSection(currentSectionId);
    if (!section) return;
    openActivityModalForSection(section, type || "tarea");
  }

  function openAssignActivityModal(sectionId) {
    const section = getSection(sectionId);
    if (!section) return;
    openActivityModalForSection(section, "tarea");
  }

  function openActivityModalForSection(section, type) {
    currentSectionId = section.id;
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
    const errors = validateActivity(data);

    if (Object.keys(errors).length) {
      UI.showFieldErrors(activityForm, errors);
      return;
    }

    const supabase = getSupabase();
    const { error } = await supabase.from("classroom_activities").insert({
      classroom_id: currentSectionId,
      type: data.type,
      title: data.title.trim(),
      topic: data.topic || null,
      due_date: data.dueDate || null,
      points: data.points ? Number(data.points) : 0,
    });

    if (error) {
      UI.showFieldErrors(activityForm, { title: error.message });
      return;
    }

    UI.closeModal("modal-activity");
    const meta = Common.ACTIVITY_TYPES[data.type] || { label: "Actividad" };
    UI.toast(`${meta.label} asignada a la sección`);

    await loadTeacherSections();
    const section = getSection(currentSectionId);
    renderActivities(section);
  }

  async function openAddStudentModal() {
    const section = getSection(currentSectionId);
    if (!section) return;
    setText("addStudentSectionName", section.name);

    const select = document.getElementById("add-student-select");
    if (!select) return;
    select.innerHTML = '<option value="">Cargando estudiantes…</option>';

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("role", "student")
      .order("name");

    if (error || !data) {
      select.innerHTML = '<option value="">No se pudieron cargar estudiantes</option>';
      return;
    }

    const existing = new Set((section.students || []).map((s) => s.id));
    const available = data.filter((p) => !existing.has(p.id));

    select.innerHTML = available.length
      ? `<option value="">Selecciona un estudiante…</option>${available
          .map((p) => `<option value="${p.id}">${Common.escapeHtml(p.name || "Sin nombre")}</option>`)
          .join("")}`
      : '<option value="">No hay estudiantes disponibles</option>';

    UI.openModal("modal-add-student");
  }

  async function handleAddStudent(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(addStudentForm).entries());
    if (!data.student) {
      UI.showFieldErrors(addStudentForm, { student: "Selecciona un estudiante." });
      return;
    }

    const supabase = getSupabase();
    const { error } = await supabase.rpc("add_student_to_classroom", {
      p_classroom_id: currentSectionId,
      p_student_id: data.student,
    });

    if (error) {
      UI.showFieldErrors(addStudentForm, { student: error.message });
      return;
    }

    UI.closeModal("modal-add-student");
    UI.toast("Estudiante añadido al aula");
    await loadTeacherSections();
    openSection(currentSectionId);
  }

  async function handleDeleteClassroom() {
    if (!currentSectionId) return;
    const section = getSection(currentSectionId);
    if (!section) return;

    if (!confirm(`¿Eliminar permanentemente el aula “${section.name}”? Se borrarán sus alumnos, actividades y reportes.`)) {
      return;
    }

    const supabase = getSupabase();
    const { error } = await supabase.rpc("delete_classroom", {
      p_classroom_id: currentSectionId,
    });

    if (error) {
      UI.toast("No se pudo eliminar el aula", "error");
      console.error("[classrooms] delete_classroom error:", error);
      return;
    }

    UI.toast("Aula eliminada", "success");
    currentSectionId = null;
    if (screenDetail) screenDetail.classList.add("hidden");
    if (screenSelect) screenSelect.classList.remove("hidden");
    await loadTeacherSections();
    renderFilterChips();
    renderSectionGrid();
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
    document.getElementById("activitiesList")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-del-activity]");
      if (!btn || !currentSectionId) return;
      const supabase = getSupabase();
      const { error } = await supabase.from("classroom_activities").delete().eq("id", btn.dataset.delActivity);
      if (error) {
        UI.toast("No se pudo eliminar la actividad", "error");
        return;
      }
      await loadTeacherSections();
      renderActivities(getSection(currentSectionId));
      UI.toast("Actividad eliminada", "info");
    });

    // Añadir alumno y eliminar aula
    document.getElementById("openAddStudent")?.addEventListener("click", openAddStudentModal);
    if (addStudentForm) addStudentForm.addEventListener("submit", handleAddStudent);
    document.getElementById("deleteClassroom")?.addEventListener("click", handleDeleteClassroom);

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
    UI.wireModal("modal-add-student");
  }

  // ─── Init ───────────────────────────────────────────────────────────
  async function init() {
    if (!Common || !UI) {
      console.error("[classrooms] Dependencias del panel docente no cargadas.");
      return;
    }

    if (window.CurrentUserService && !CurrentUserService.getProfile()) {
      await CurrentUserService.init();
    }

    const params = new URLSearchParams(window.location.search);
    _assignMode = params.get("assign") === "1";

    await loadTeacherSections();
    populateCourseSelect();
    renderFilterChips();
    renderSectionGrid();
    bindEvents();

    if (_assignMode) {
      showAssignModeBanner();
      return;
    }

    // Deep-link: ?section=ID abre el detalle; ?create=1 abre el modal.
    const target = params.get("section");
    if (target && getSection(target)) {
      openSection(target);
    } else if (params.get("create") === "1") {
      openCreateSection();
    }
  }

  function showAssignModeBanner() {
    if (!screenSelect) return;
    let banner = document.getElementById("assign-mode-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "assign-mode-banner";
      banner.className = "assign-mode-banner";
      banner.innerHTML = `
        <span>Selecciona una sección para asignar una tarea.</span>
        <a class="btn btn-ghost-sm" href="classrooms.html">Cancelar</a>
      `;
      screenSelect.insertBefore(banner, screenSelect.firstChild);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
