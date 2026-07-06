// ==========================================================================
// assets/js/teacher/teacher-store.js
// CAPA DE DATOS DEL PANEL DOCENTE (secciones / aulas)
// ==========================================================================
// Persistencia 100% client-side en localStorage, sembrada desde
// mock/teacher-classroom.json. Toda lectura/escritura de secciones y
// actividades (tareas, retos, quizzes) pasa por aquí.
//
// API pública (window.TeacherStore):
//   await init()                       → siembra si hace falta y resuelve
//   getSections()                      → Array de secciones
//   getSection(id)                     → sección | null
//   createSection(payload)             → { ok, section?, errors? }
//   updateSection(id, patch)           → sección | null
//   deleteSection(id)                  → boolean
//   addActivity(sectionId, activity)   → { ok, activity?, errors? }
//   removeActivity(sectionId, actId)   → boolean
//   computeStats(section)              → métricas agregadas de la sección
//   aggregate()                        → métricas globales de todas las aulas
// ==========================================================================

(function () {
  "use strict";

  const STORAGE_KEY = "eduquest_teacher_sections";
  const VERSION_KEY = "eduquest_teacher_sections_v";
  const SCHEMA_VERSION = 2;
  const MOCK_PATH = "../../mock/teacher-classroom.json";

  let cache = null; // Array de secciones en memoria (espejo de localStorage)

  // ─── Persistencia base ──────────────────────────────────────────────

  function read() {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      cache = raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error("[TeacherStore] localStorage corrupto, reiniciando:", err);
      cache = [];
    }
    return cache;
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache || []));
  }

  // ─── Utilidades internas ────────────────────────────────────────────

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // quita tildes/diacríticos
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 24);
  }

  function uniqueId(base) {
    const sections = read();
    let id = base || "sec";
    let n = 2;
    while (sections.some((s) => s.id === id)) {
      id = `${base}-${n++}`;
    }
    return id;
  }

  function randomToken(len) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin caracteres ambiguos
    let out = "";
    for (let i = 0; i < len; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  /** Genera un código de unión único tipo `FIS-7K2A`. */
  function generateJoinCode(course) {
    const sections = read();
    const prefix = slugify(course).replace(/-/g, "").slice(0, 3).toUpperCase() || "AUL";
    let code;
    do {
      code = `${prefix}-${randomToken(4)}`;
    } while (sections.some((s) => s.joinCode === code));
    return code;
  }

  // ─── Validación ─────────────────────────────────────────────────────

  function validateSection(payload, { ignoreId } = {}) {
    const errors = {};
    const name = (payload.name || "").trim();
    const course = (payload.course || "").trim();

    if (!course) errors.course = "Selecciona un curso.";
    if (!name) {
      errors.name = "Ponle un nombre a la sección.";
    } else if (name.length < 3) {
      errors.name = "El nombre es demasiado corto.";
    } else {
      const dup = read().some(
        (s) => s.id !== ignoreId && s.name.trim().toLowerCase() === name.toLowerCase()
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

  // ─── API pública ────────────────────────────────────────────────────

  const TeacherStore = {
    /**
     * Siembra el almacén desde el mock si está vacío o desactualizado.
     * Idempotente: respeta las secciones creadas por el docente.
     * @returns {Promise<Array>} Lista de secciones.
     */
    async init() {
      const storedVersion = Number(localStorage.getItem(VERSION_KEY));
      const hasData = !!localStorage.getItem(STORAGE_KEY);

      if (hasData && storedVersion === SCHEMA_VERSION) {
        return read();
      }

      // Primera carga o cambio de esquema: sembrar desde el mock.
      try {
        const res = await fetch(MOCK_PATH);
        if (res.ok) {
          const data = await res.json();
          cache = Array.isArray(data.sections) ? data.sections : [];
        } else {
          cache = cache || [];
        }
      } catch (err) {
        console.error("[TeacherStore] No se pudo cargar el mock:", err);
        cache = read(); // conservar lo que hubiera
      }

      persist();
      localStorage.setItem(VERSION_KEY, String(SCHEMA_VERSION));
      return cache;
    },

    getSections() {
      return read();
    },

    getSection(id) {
      return read().find((s) => s.id === id) || null;
    },

    /**
     * Crea una nueva sección validada.
     * @returns {{ok:boolean, section?:Object, errors?:Object}}
     */
    createSection(payload) {
      const errors = validateSection(payload);
      if (Object.keys(errors).length) return { ok: false, errors };

      const sections = read();
      const section = {
        id: uniqueId(slugify(`${payload.course}-${payload.name}`) || "seccion"),
        course: payload.course.trim(),
        name: payload.name.trim(),
        cycle: (payload.cycle || "").trim(),
        shift: (payload.shift || "").trim(),
        schedule: (payload.schedule || "").trim(),
        capacity: payload.capacity ? Number(payload.capacity) : null,
        joinCode: generateJoinCode(payload.course),
        description: (payload.description || "").trim(),
        createdAt: new Date().toISOString(),
        topicPerformance: [],
        weeklyActivity: [],
        students: [],
        activities: [],
      };

      sections.unshift(section); // las más nuevas primero
      persist();
      return { ok: true, section };
    },

    updateSection(id, patch) {
      const sections = read();
      const section = sections.find((s) => s.id === id);
      if (!section) return null;
      Object.assign(section, patch);
      persist();
      return section;
    },

    deleteSection(id) {
      const sections = read();
      const idx = sections.findIndex((s) => s.id === id);
      if (idx === -1) return false;
      sections.splice(idx, 1);
      persist();
      return true;
    },

    /**
     * Añade una actividad (tarea / reto / quiz) a una sección.
     * @returns {{ok:boolean, activity?:Object, errors?:Object}}
     */
    addActivity(sectionId, payload) {
      const section = this.getSection(sectionId);
      if (!section) return { ok: false, errors: { section: "Sección no encontrada." } };

      const errors = validateActivity(payload);
      if (Object.keys(errors).length) return { ok: false, errors };

      const activity = {
        id: `act-${Date.now()}-${randomToken(4).toLowerCase()}`,
        type: payload.type,
        title: payload.title.trim(),
        topic: (payload.topic || "").trim(),
        dueDate: payload.dueDate || null,
        points: payload.points ? Number(payload.points) : 0,
        createdAt: new Date().toISOString(),
      };

      if (!Array.isArray(section.activities)) section.activities = [];
      section.activities.unshift(activity);
      persist();
      return { ok: true, activity };
    },

    removeActivity(sectionId, activityId) {
      const section = this.getSection(sectionId);
      if (!section || !Array.isArray(section.activities)) return false;
      const idx = section.activities.findIndex((a) => a.id === activityId);
      if (idx === -1) return false;
      section.activities.splice(idx, 1);
      persist();
      return true;
    },

    generateJoinCode,

    /**
     * Calcula métricas agregadas de una sección a partir de sus alumnos.
     * @returns {Object} { students, avgXp, activity, avgAccuracy,
     *   avgCompletion, totalSimulacros, distribution, atRisk, topPerformer }
     */
    computeStats(section) {
      const students = (section && section.students) || [];
      const count = students.length;

      const empty = {
        students: 0,
        avgXp: 0,
        activity: section ? section.activity || 0 : 0,
        avgAccuracy: 0,
        avgCompletion: 0,
        totalSimulacros: 0,
        distribution: { excelente: 0, bueno: 0, regular: 0, riesgo: 0 },
        atRisk: 0,
        topPerformer: null,
      };
      if (!count) return empty;

      const Common = window.TeacherCommon;
      const distribution = { excelente: 0, bueno: 0, regular: 0, riesgo: 0 };
      let sumXp = 0;
      let sumAcc = 0;
      let sumComp = 0;
      let sumSim = 0;
      let top = students[0];

      students.forEach((s) => {
        sumXp += s.xp || 0;
        sumAcc += s.accuracy || 0;
        sumComp += s.completion || 0;
        sumSim += s.simulacros || 0;
        if ((s.xp || 0) > (top.xp || 0)) top = s;
        const band = Common ? Common.performanceBand(s.accuracy || 0).key : "regular";
        distribution[band] = (distribution[band] || 0) + 1;
      });

      // % de actividad: si la sección no lo trae, lo derivamos de la
      // última semana de weeklyActivity vs. nº de alumnos.
      let activity = section.activity;
      if (activity == null && Array.isArray(section.weeklyActivity) && section.weeklyActivity.length) {
        const last = section.weeklyActivity[section.weeklyActivity.length - 1];
        activity = count ? Math.min(100, Math.round(((last.active || 0) / count) * 100)) : 0;
      }

      return {
        students: count,
        avgXp: Math.round(sumXp / count),
        activity: activity != null ? activity : 0,
        avgAccuracy: Math.round(sumAcc / count),
        avgCompletion: Math.round(sumComp / count),
        totalSimulacros: sumSim,
        distribution,
        atRisk: distribution.regular + distribution.riesgo,
        topPerformer: top,
      };
    },

    /**
     * Métricas globales sumando todas las secciones (para el inicio).
     * @returns {Object} { sections, students, avgXp, avgAccuracy,
     *   activities, distribution }
     */
    aggregate() {
      const sections = read();
      const totals = {
        sections: sections.length,
        students: 0,
        avgXp: 0,
        avgAccuracy: 0,
        activities: 0,
        distribution: { excelente: 0, bueno: 0, regular: 0, riesgo: 0 },
      };

      let xpAccum = 0;
      let accAccum = 0;
      let studentAccum = 0;

      sections.forEach((section) => {
        const stats = this.computeStats(section);
        totals.students += stats.students;
        totals.activities += (section.activities || []).length;
        xpAccum += stats.avgXp * stats.students;
        accAccum += stats.avgAccuracy * stats.students;
        studentAccum += stats.students;
        Object.keys(totals.distribution).forEach((k) => {
          totals.distribution[k] += stats.distribution[k];
        });
      });

      if (studentAccum) {
        totals.avgXp = Math.round(xpAccum / studentAccum);
        totals.avgAccuracy = Math.round(accAccum / studentAccum);
      }
      return totals;
    },
  };

  window.TeacherStore = TeacherStore;
})();
