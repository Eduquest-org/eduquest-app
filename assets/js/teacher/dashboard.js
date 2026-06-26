// ==========================================================================
// assets/js/teacher/dashboard.js
// Comportamiento del shell docente (menú móvil) + inicio (accesos rápidos)
// ==========================================================================
// Se carga en todas las páginas del docente; la lógica específica del inicio
// se activa solo si encuentra sus nodos.
// ==========================================================================

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

  // Mapeo de accesos rápidos por su título visible.
  const TILE_NAV = {
    "Crear aula": "classrooms.html?create=1",
    "Ver secciones": "classrooms.html",
    "Asignar tarea": "classrooms.html",
    "Calificar tareas": "classrooms.html",
  };

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

    // Enlaces y botones de los paneles laterales.
    document.querySelectorAll(".panel-link").forEach((link) => {
      if (link.textContent.includes("Ver secciones")) {
        link.style.cursor = "pointer";
        link.addEventListener("click", () => (window.location.href = "classrooms.html"));
      }
    });
    document.querySelectorAll(".panel .full-btn").forEach((btn) => {
      if (btn.textContent.trim() === "Asignar tarea") {
        btn.addEventListener("click", () => (window.location.href = "classrooms.html"));
      }
    });
  }

  function refreshSectionsSummary() {
    const summary = document.getElementById("sectionsSummary");
    if (!summary || !window.TeacherStore) return;
    TeacherStore.init().then(() => {
      const agg = TeacherStore.aggregate();
      const aulas = agg.sections === 1 ? "1 aula activa" : `${agg.sections} aulas activas`;
      summary.textContent = `${aulas} · ${agg.students} alumnos en total`;
    });
  }

  function init() {
    // Solo actúa si estamos en el inicio (hay accesos rápidos).
    if (!document.querySelector(".quick-actions")) return;
    wireQuickActions();
    refreshSectionsSummary();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
