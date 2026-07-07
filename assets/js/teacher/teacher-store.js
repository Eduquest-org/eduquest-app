// ==========================================================================
// assets/js/teacher/teacher-store.js
// CAPA DE DATOS DEL PANEL DOCENTE (secciones / aulas)
// ==========================================================================
// Integración con Supabase para la persistencia real de los datos.
// API pública (window.TeacherStore):
//   await init()                       → siembra la cache desde Supabase
//   getSections()                      → Array de secciones (sincrónico, lee cache)
//   getSection(id)                     → sección | null (sincrónico, lee cache)
//   createSection(payload)             → { ok, section?, errors? } (asíncrono)
//   updateSection(id, patch)           → sección | null (asíncrono)
//   deleteSection(id)                  → boolean (asíncrono)
//   addActivity(sectionId, activity)   → { ok, activity?, errors? } (asíncrono)
//   removeActivity(sectionId, actId)   → boolean (asíncrono)
//   computeStats(section)              → métricas agregadas de la sección
//   aggregate()                        → métricas globales de todas las aulas
// ==========================================================================

(function () {
  "use strict";

  let cache = []; // Array de secciones en memoria

  function getSupabase() {
    return window.supabase || null;
  }

  function getCurrentTeacherId() {
    return window.CurrentUserService?.getId() || null;
  }

  // ─── Utilidades internas ────────────────────────────────────────────

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // quita tildes/diacríticos
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 24);
  }

  function randomToken(len) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin caracteres ambiguos
    let out = "";
    for (let i = 0; i < len; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  function generateJoinCode(course) {
    const prefix = slugify(course).replace(/-/g, "").slice(0, 3).toUpperCase() || "AUL";
    let code;
    do {
      code = `${prefix}-${randomToken(4)}`;
    } while (cache.some((s) => s.joinCode === code));
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
      const dup = cache.some(
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
    async init() {
      const supabase = getSupabase();
      const teacherId = getCurrentTeacherId();
      if (!supabase || !teacherId) {
        console.warn("[TeacherStore] Supabase o TeacherId no disponibles, usando caché vacío.");
        cache = [];
        return cache;
      }

      try {
        // 1. Obtener classrooms del profesor
        const { data: classrooms, error: classErr } = await supabase
          .from("classrooms")
          .select("*")
          .eq("teacher_id", teacherId)
          .order("created_at", { ascending: false });

        if (classErr) throw classErr;

        if (!classrooms || classrooms.length === 0) {
          cache = [];
          return cache;
        }

        const classIds = classrooms.map(c => c.id);

        // 2. Obtener actividades de estas aulas
        const { data: activities, error: actErr } = await supabase
          .from("classroom_activities")
          .select("*")
          .in("classroom_id", classIds)
          .order("created_at", { ascending: false });
        if (actErr) throw actErr;

        // 3. Obtener estudiantes matriculados y sus perfiles
        // Nota: Un JOIN más completo sería ideal, pero lo simulamos pidiendo los estudiantes
        const { data: enrollments, error: enrollErr } = await supabase
          .from("classroom_students")
          .select("classroom_id, student_id, profiles(name)")
          .in("classroom_id", classIds);
        if (enrollErr) throw enrollErr;

        const studentIds = enrollments.map(e => e.student_id);
        
        // 4. Obtener progreso/XP de los estudiantes si existen
        let userStatsMap = {};
        if (studentIds.length > 0) {
          const { data: stats, error: statsErr } = await supabase
            .from("user_topic_stats")
            .select("user_id, correct_answers, incorrect_answers, total_attempts")
            .in("user_id", studentIds);
            
          if (!statsErr && stats) {
             stats.forEach(st => {
                 if (!userStatsMap[st.user_id]) userStatsMap[st.user_id] = { correct: 0, total: 0, attempts: 0 };
                 userStatsMap[st.user_id].correct += (st.correct_answers || 0);
                 userStatsMap[st.user_id].total += ((st.correct_answers || 0) + (st.incorrect_answers || 0));
                 userStatsMap[st.user_id].attempts += (st.total_attempts || 0);
             });
          }
        }

        // Armar el caché con la misma estructura que espera la UI
        cache = classrooms.map(c => {
          const sectionActivities = (activities || []).filter(a => a.classroom_id === c.id).map(a => ({
              id: a.id,
              type: a.type,
              title: a.title,
              topic: a.topic,
              dueDate: a.due_date,
              points: a.points,
              createdAt: a.created_at
          }));

          const sectionEnrollments = (enrollments || []).filter(e => e.classroom_id === c.id);
          const sectionStudents = sectionEnrollments.map(e => {
              const uStats = userStatsMap[e.student_id] || { correct: 0, total: 0, attempts: 0 };
              const acc = uStats.total > 0 ? Math.round((uStats.correct / uStats.total) * 100) : 0;
              return {
                  id: e.student_id,
                  name: e.profiles?.name || "Alumno Anónimo",
                  xp: uStats.correct * 10, // Estimación de XP basado en aciertos
                  accuracy: acc,
                  completion: Math.min(100, uStats.attempts * 5),
                  simulacros: Math.floor(uStats.attempts / 10),
                  activity: uStats.attempts > 0 ? "Activo recientemente" : "Sin actividad reciente"
              };
          });

          return {
            id: c.id,
            course: c.course || "General",
            name: c.name,
            cycle: c.cycle || "",
            shift: c.shift || "",
            schedule: c.schedule || "",
            capacity: c.capacity,
            joinCode: c.join_code,
            description: c.description || "",
            createdAt: c.created_at,
            activities: sectionActivities,
            students: sectionStudents,
            topicPerformance: [], // Pendiente de agregación por topic real si se desea
            weeklyActivity: [] // Se podría derivar de un histórico, actualmente vacío
          };
        });

      } catch (err) {
        console.error("[TeacherStore] Error cargando datos de Supabase:", err);
      }

      return cache;
    },

    getSections() {
      return cache;
    },

    getSection(id) {
      return cache.find((s) => s.id === id) || null;
    },

    async createSection(payload) {
      const errors = validateSection(payload);
      if (Object.keys(errors).length) return { ok: false, errors };

      const supabase = getSupabase();
      const teacherId = getCurrentTeacherId();
      if (!supabase || !teacherId) return { ok: false, errors: { server: "No autenticado" } };

      const joinCode = generateJoinCode(payload.course);
      const newClassroom = {
        teacher_id: teacherId,
        name: payload.name.trim(),
        course: payload.course.trim(),
        cycle: (payload.cycle || "").trim(),
        shift: (payload.shift || "").trim(),
        schedule: (payload.schedule || "").trim(),
        capacity: payload.capacity ? Number(payload.capacity) : null,
        join_code: joinCode,
        description: (payload.description || "").trim()
      };

      try {
        const { data, error } = await supabase
          .from("classrooms")
          .insert(newClassroom)
          .select()
          .single();

        if (error) throw error;

        // Formatear para caché local
        const section = {
          id: data.id,
          course: data.course,
          name: data.name,
          cycle: data.cycle,
          shift: data.shift,
          schedule: data.schedule,
          capacity: data.capacity,
          joinCode: data.join_code,
          description: data.description,
          createdAt: data.created_at,
          topicPerformance: [],
          weeklyActivity: [],
          students: [],
          activities: [],
        };

        cache.unshift(section);
        return { ok: true, section };
      } catch (err) {
        console.error("[TeacherStore] Error creando sección:", err);
        return { ok: false, errors: { server: "Error al guardar en la base de datos." } };
      }
    },

    async updateSection(id, patch) {
      const section = this.getSection(id);
      if (!section) return null;
      
      const supabase = getSupabase();
      if (!supabase) return null;

      try {
          const dbPatch = {};
          if (patch.name !== undefined) dbPatch.name = patch.name;
          if (patch.course !== undefined) dbPatch.course = patch.course;
          if (patch.cycle !== undefined) dbPatch.cycle = patch.cycle;
          if (patch.shift !== undefined) dbPatch.shift = patch.shift;
          if (patch.schedule !== undefined) dbPatch.schedule = patch.schedule;
          if (patch.description !== undefined) dbPatch.description = patch.description;
          if (patch.capacity !== undefined) dbPatch.capacity = patch.capacity;

          const { error } = await supabase.from("classrooms").update(dbPatch).eq("id", id);
          if (error) throw error;

          Object.assign(section, patch);
          return section;
      } catch(err) {
          console.error("Error actualizando aula", err);
          return null;
      }
    },

    async deleteSection(id) {
      const idx = cache.findIndex((s) => s.id === id);
      if (idx === -1) return false;

      const supabase = getSupabase();
      if (!supabase) return false;

      try {
          const { error } = await supabase.from("classrooms").delete().eq("id", id);
          if (error) throw error;
          cache.splice(idx, 1);
          return true;
      } catch(err) {
          console.error("Error eliminando aula", err);
          return false;
      }
    },

    async addActivity(sectionId, payload) {
      const section = this.getSection(sectionId);
      if (!section) return { ok: false, errors: { section: "Sección no encontrada." } };

      const errors = validateActivity(payload);
      if (Object.keys(errors).length) return { ok: false, errors };

      const supabase = getSupabase();
      if (!supabase) return { ok: false, errors: { server: "No autenticado" } };

      const newActivity = {
        classroom_id: sectionId,
        type: payload.type,
        title: payload.title.trim(),
        topic: (payload.topic || "").trim(),
        due_date: payload.dueDate || null,
        points: payload.points ? Number(payload.points) : 0,
      };

      try {
          const { data, error } = await supabase.from("classroom_activities").insert(newActivity).select().single();
          if (error) throw error;
          
          const activity = {
              id: data.id,
              type: data.type,
              title: data.title,
              topic: data.topic,
              dueDate: data.due_date,
              points: data.points,
              createdAt: data.created_at
          };

          if (!Array.isArray(section.activities)) section.activities = [];
          section.activities.unshift(activity);
          return { ok: true, activity };
      } catch(err) {
          console.error("Error agregando actividad", err);
          return { ok: false, errors: { server: "Error al guardar la actividad en base de datos." } };
      }
    },

    async removeActivity(sectionId, activityId) {
      const section = this.getSection(sectionId);
      if (!section || !Array.isArray(section.activities)) return false;
      const idx = section.activities.findIndex((a) => a.id === activityId);
      if (idx === -1) return false;

      const supabase = getSupabase();
      if (!supabase) return false;

      try {
          const { error } = await supabase.from("classroom_activities").delete().eq("id", activityId);
          if (error) throw error;
          
          section.activities.splice(idx, 1);
          return true;
      } catch (err) {
          console.error("Error eliminando actividad", err);
          return false;
      }
    },

    generateJoinCode,

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

    aggregate() {
      const totals = {
        sections: cache.length,
        students: 0,
        avgXp: 0,
        avgAccuracy: 0,
        activities: 0,
        distribution: { excelente: 0, bueno: 0, regular: 0, riesgo: 0 },
      };

      let xpAccum = 0;
      let accAccum = 0;
      let studentAccum = 0;

      cache.forEach((section) => {
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
