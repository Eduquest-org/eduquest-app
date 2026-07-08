// ==========================================================================
// assets/js/teacher/dashboard.js
// Comportamiento del shell docente (menú móvil) + inicio (accesos rápidos)
// ==========================================================================
// Se carga en todas las páginas del docente; la lógica específica del inicio
// se activa solo si encuentra sus nodos.
// ==========================================================================

// --- Perfil global del docente (todas las páginas teacher/) ---
document.addEventListener("DOMContentLoaded", async () => {
  if (window.CurrentUserService) {
    await CurrentUserService.init();
  }
  if (window.UserBindingManager) {
    UserBindingManager.bindAll();
  }
});

// --- Menú móvil (delegación: sidebar/navbar se inyectan async) ---
document.addEventListener("click", (e) => {
  const toggle = e.target.closest("#menuToggle");
  const backdrop = document.getElementById("backdrop");
  const sidebar = document.getElementById("sidebar");

  if (toggle) {
    if (sidebar) sidebar.classList.toggle("open");
    if (backdrop) backdrop.classList.toggle("open");
    return;
  }
  if (e.target === backdrop) {
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.remove("open");
  }
});

// --- Inicio del docente: accesos rápidos y resumen dinámico ---
(function () {
  "use strict";

  const TILE_NAV = {
    "Crear aula": "classrooms.html?create=1",
    "Ver secciones": "classrooms.html",
    "Asignar tarea": "classrooms.html?assign=1",
    "Recursos": "resources.html",
  };

  function getSupabase() {
    return window.supabase || null;
  }

  async function waitForSupabase(maxMs = 3000) {
    const start = Date.now();
    while (!getSupabase() && Date.now() - start < maxMs) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return getSupabase();
  }

  async function getTeacherScope(teacherId) {
    const supabase = getSupabase();
    if (!supabase || !teacherId) return { classroomIds: [], studentIds: [] };

    const { data: classrooms, error: classErr } = await supabase
      .from("classrooms")
      .select("id")
      .eq("teacher_id", teacherId);

    if (classErr) {
      console.error("[dashboard] Error cargando aulas:", classErr);
      return { classroomIds: [], studentIds: [] };
    }

    const classroomIds = (classrooms ?? []).map((c) => c.id);
    if (!classroomIds.length) return { classroomIds, studentIds: [] };

    const { data: enrollments, error: enrollErr } = await supabase
      .from("classroom_students")
      .select("student_id")
      .in("classroom_id", classroomIds);

    if (enrollErr) {
      console.error("[dashboard] Error cargando alumnos:", enrollErr);
      return { classroomIds, studentIds: [] };
    }

    const studentIds = [...new Set((enrollments ?? []).map((e) => e.student_id))];
    return { classroomIds, studentIds };
  }

  function refreshSectionsSummary(scope) {
    const summary = document.getElementById("sectionsSummary");
    if (!summary) return;

    const sectionCount = scope.classroomIds.length;
    const studentCount = scope.studentIds.length;

    if (sectionCount === 0) {
      summary.textContent = "Sin aulas activas · 0 alumnos en total";
      return;
    }

    const aulas =
      sectionCount === 1 ? "1 aula activa" : `${sectionCount} aulas activas`;
    summary.textContent = `${aulas} · ${studentCount} alumnos en total`;
  }

  async function refreshPerformancePanel(studentIds) {
    const barCorrect = document.getElementById("perfBarCorrect");
    const barError = document.getElementById("perfBarError");
    const correctEl = document.getElementById("perfCorrectCount");
    const errorEl = document.getElementById("perfErrorCount");
    const noteEl = document.getElementById("perfAccuracyNote");

    if (!barCorrect || !barError || !correctEl || !errorEl || !noteEl) return;

    const supabase = getSupabase();
    if (!supabase || !studentIds.length) {
      barCorrect.style.width = "0%";
      barError.style.width = "0%";
      correctEl.textContent = "0";
      errorEl.textContent = "0";
      noteEl.textContent = "Sin datos de rendimiento";
      return;
    }

    const { data: stats, error } = await supabase
      .from("user_topic_stats")
      .select("correct_answers, incorrect_answers")
      .in("user_id", studentIds);

    if (error) {
      console.error("[dashboard] Error cargando stats:", error);
      noteEl.textContent = "No se pudo cargar el rendimiento";
      return;
    }

    let totalCorrect = 0;
    let totalIncorrect = 0;
    (stats ?? []).forEach((row) => {
      totalCorrect += row.correct_answers ?? 0;
      totalIncorrect += row.incorrect_answers ?? 0;
    });

    const total = totalCorrect + totalIncorrect;
    const pct = total > 0 ? Math.round((totalCorrect / total) * 100) : 0;

    barCorrect.style.width = `${pct}%`;
    barError.style.width = `${total > 0 ? 100 - pct : 0}%`;
    correctEl.textContent = totalCorrect.toLocaleString("es-PE");
    errorEl.textContent = totalIncorrect.toLocaleString("es-PE");
    noteEl.textContent =
      total > 0
        ? `${pct}% de aciertos en general`
        : "Sin datos de rendimiento";
  }

  async function refreshXpPanel(scope) {
    const totalEl = document.getElementById("xpTotalCount");
    const avgLabel = document.getElementById("xpAvgLabel");
    const studentsCount = document.getElementById("xpStudentsCount");
    const noteEl = document.getElementById("xpClassNote");

    if (!totalEl || !avgLabel || !studentsCount || !noteEl) return;

    const supabase = getSupabase();
    if (!supabase || !scope.classroomIds.length) {
      totalEl.textContent = "0";
      avgLabel.textContent = "0 XP promedio por alumno";
      studentsCount.textContent = "0";
      noteEl.textContent = "Sin aulas activas";
      return;
    }

    const { data, error } = await supabase
      .from("classroom_student_stats")
      .select("student_id, total_xp")
      .in("classroom_id", scope.classroomIds);

    if (error) {
      console.error("[dashboard] Error cargando XP:", error);
      noteEl.textContent = "No se pudo cargar el XP";
      return;
    }

    const rows = data || [];
    const totalXp = rows.reduce((sum, r) => sum + (r.total_xp || 0), 0);
    const activeStudents = rows.filter((r) => r.total_xp > 0).length;
    const avg = scope.studentIds.length ? Math.round(totalXp / scope.studentIds.length) : 0;

    totalEl.textContent = totalXp.toLocaleString("es-PE");
    avgLabel.textContent = `${avg.toLocaleString("es-PE")} XP promedio por alumno`;
    studentsCount.textContent = activeStudents.toLocaleString("es-PE");
    noteEl.textContent = `${scope.classroomIds.length} ${scope.classroomIds.length === 1 ? "aula" : "aulas"} · ${scope.studentIds.length} ${scope.studentIds.length === 1 ? "alumno" : "alumnos"}`;
  }

  function hideGradingPanel() {
    const gradedPanel = document.getElementById("gradedPanel");
    if (!gradedPanel) return;

    const classIds = scope.classrooms.map(c => c.id);
    if (!classIds.length) {
      gradedPanel.hidden = false;
      gradedPanel.innerHTML = '<p class="stat-label" style="margin-top:10px;">Crea un aula para asignar tareas.</p>';
      return;
    }

    try {
      const { data: activities } = await window.supabase
        .from('classroom_activities')
        .select('id')
        .in('classroom_id', classIds);
        
      if (!activities || !activities.length) {
          gradedPanel.hidden = false;
          gradedPanel.innerHTML = '<p class="stat-label" style="margin-top:10px;">No hay tareas asignadas aún.</p>';
          return;
      }
      
      const actIds = activities.map(a => a.id);
      const { data: submissions } = await window.supabase
        .from('activity_submissions')
        .select('id, status')
        .in('activity_id', actIds);
        
      const total = (submissions || []).length;
      const pending = (submissions || []).filter(s => s.status === 'pending').length;
      const graded = total - pending;

      gradedPanel.hidden = false;
      gradedPanel.innerHTML = `
        <div class="stat-row">
          <span class="stat-big" style="color:var(--brand);">${pending}</span>
          <span class="stat-of"> por revisar</span>
        </div>
        <p class="stat-label" style="margin-bottom:8px;">De ${total} entregas totales</p>
        <div class="progress-track" style="background:rgba(0,0,0,0.05); height:8px; border-radius:4px; margin: 10px 0;">
          <div class="progress-fill" style="width:${total > 0 ? (graded/total)*100 : 0}%; background:var(--brand); height:100%; border-radius:4px;"></div>
        </div>
        <div class="streak-row" style="font-size:13px; color:var(--sub);"><span style="color:var(--amber);">⭐</span> ${graded} calificadas</div>
      `;
    } catch(err) {
      console.error("Error al cargar calificaciones:", err);
      gradedPanel.hidden = false;
    }
  }

  async function initDashboardData() {
    await waitForSupabase();

    if (window.CurrentUserService && !CurrentUserService.getProfile()) {
      await CurrentUserService.init();
    }

    const teacherId = window.CurrentUserService?.getProfile()?.id;
    if (!teacherId) return;

    const scope = await getTeacherScope(teacherId);
    refreshSectionsSummary(scope);
    await refreshPerformancePanel(scope.studentIds);
    await refreshXpPanel(scope);
    hideGradingPanel();
  }

  function wireQuickActions() {
    document.querySelectorAll(".action-tile").forEach((tile) => {
      const key = tile.querySelector("h4")?.textContent.trim();
      const dest = TILE_NAV[key];
      if (!dest) return;
      tile.style.cursor = "pointer";
      tile.setAttribute("role", "button");
      tile.addEventListener("click", () => {
        window.location.href = dest;
      });
    });

    document.querySelectorAll(".panel-link").forEach((link) => {
      if (link.textContent.includes("Ver secciones")) {
        link.style.cursor = "pointer";
        link.addEventListener("click", () => (window.location.href = "classrooms.html"));
      }
    });
    document.querySelectorAll(".panel .full-btn").forEach((btn) => {
      if (btn.textContent.trim() === "Asignar tarea") {
        btn.addEventListener("click", () => (window.location.href = "classrooms.html?assign=1"));
      }
    });
  }

  async function init() {
    if (!document.querySelector(".quick-actions")) return;
    wireQuickActions();
    await initDashboardData();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
