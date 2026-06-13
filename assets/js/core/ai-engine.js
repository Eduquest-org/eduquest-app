/**
 * AIEngine — Motor de Planificación Académica.
 *
 * Arquitectura:
 * - La SELECCIÓN de cursos es DETERMINÍSTICA: todos los cursos con peso > 0
 *   para la universidad objetivo SIEMPRE aparecen como tarjetas.
 * - La IA decide: (1) el ORDEN de prioridad entre cursos, y
 *   (2) el ORDEN de tópicos dentro de cada curso respetando prerequisitos.
 * - La IA NO inventa cursos ni temas. Solo ordena IDs reales.
 * - Las llamadas a Gemini se realizan a través de un backend proxy.
 */

// ─── Configuración del Backend ──────────────────────────────────────
// Cambia esta URL cuando despliegues el backend en Render u otro servicio.
const BACKEND_URL = 'https://eduquest-backend-q4ql.onrender.com';

const AIEngine = {

    // ─── Graph Traversal ────────────────────────────────────────────
    _buildSubGraph(topicIds, allTopics) {
        const visited = new Set();
        const traverse = (topicId) => {
            if (visited.has(topicId)) return;
            visited.add(topicId);
            const topic = allTopics.find(t => t.id === topicId);
            if (!topic) return;
            if (topic.prerequisites && topic.prerequisites.length > 0) {
                topic.prerequisites.forEach(reqId => traverse(reqId));
            }
        };
        topicIds.forEach(id => traverse(id));
        return Array.from(visited);
    },

    // ─── Análisis de Diagnóstico ────────────────────────────────────
    _analyzeDiagnostic(diagnosticResults, allTopics, allCourses) {
        const strengths = [];
        const weaknesses = [];

        diagnosticResults.forEach(result => {
            const topic = allTopics.find(t => t.id === result.topicId);
            if (!topic) return;
            const course = allCourses.find(c => c.id === topic.courseId);
            const entry = {
                topicId: result.topicId,
                topicName: topic.name,
                courseId: topic.courseId,
                courseName: course ? course.name : topic.courseId,
                difficulty: topic.difficulty
            };
            if (result.isCorrect) {
                strengths.push(entry);
            } else {
                weaknesses.push(entry);
            }
        });

        return { strengths, weaknesses };
    },

    // ─── Punto de entrada ───────────────────────────────────────────
    async generatePersonalizedRoadmap(diagnosticResults) {
        try {
            // 1. Cargar catálogo completo + pesos
            const [coursesRes, topicsRes, weightsRes] = await Promise.all([
                fetch('../../mock/courses.json'),
                fetch('../../mock/topics.json'),
                fetch('../../mock/university-weights.json')
            ]);
            const allCourses = await coursesRes.json();
            const allTopics = await topicsRes.json();
            const allWeights = await weightsRes.json();

            // 2. Obtener perfil del usuario
            const session = Storage.getSession();
            const users = JSON.parse(localStorage.getItem('eduquest_db_users')) || [];
            const user = users.find(u => u.id === session.userId) || {};
            const targetUniv = user.target || 'UNI';
            const career = user.career || 'Ingeniería';

            // 3. Obtener pesos para la universidad objetivo
            const univWeights = allWeights[targetUniv] || allWeights['UNI'] || {};

            // 4. SELECCIÓN DETERMINÍSTICA: todos los cursos con peso > 0
            const relevantCourses = allCourses.filter(c => {
                const weight = univWeights[c.id];
                return weight !== undefined && weight > 0;
            });

            // 5. Analizar diagnóstico
            const { strengths, weaknesses } = this._analyzeDiagnostic(
                diagnosticResults, allTopics, allCourses
            );

            // 6. Expandir debilidades con prerequisitos (Graph Traversal)
            const weakTopicIds = weaknesses.map(w => w.topicId);
            const requiredTopicIds = this._buildSubGraph(weakTopicIds, allTopics);

            // 7. Construir el catálogo de cursos relevantes para el prompt
            const courseCatalogText = relevantCourses.map(c => {
                const weight = univWeights[c.id] || 0;
                const cTopics = allTopics.filter(t => t.courseId === c.id);
                const topicLines = cTopics.length > 0
                    ? cTopics.map(t => {
                        const reqs = t.prerequisites && t.prerequisites.length > 0
                            ? t.prerequisites.join(', ')
                            : 'ninguno';
                        return `    - ${t.id}: "${t.name}" (dificultad: ${t.difficulty}, prerequisitos: [${reqs}])`;
                    }).join('\n')
                    : '    (Sin tópicos registrados)';
                return `Curso: ${c.id} ("${c.name}") — Peso admisión ${targetUniv}: ${weight}/100\n${topicLines}`;
            }).join('\n\n');

            const strengthsText = strengths.length > 0
                ? strengths.map(s => `  ✓ ${s.topicName} (${s.courseName})`).join('\n')
                : '  Ninguna detectada en este diagnóstico.';

            const weaknessesText = weaknesses.length > 0
                ? weaknesses.map(w => `  ✗ ${w.topicName} (${w.courseName})`).join('\n')
                : '  Ninguna detectada en este diagnóstico.';

            const graphText = requiredTopicIds.length > 0
                ? requiredTopicIds.map(tId => {
                    const t = allTopics.find(x => x.id === tId);
                    if (!t) return '';
                    const reqs = t.prerequisites && t.prerequisites.length > 0
                        ? t.prerequisites.map(r => allTopics.find(x => x.id === r)?.name || r).join(', ')
                        : 'Tema Raíz';
                    return `  - ${t.name} [${t.id}] → requiere: ${reqs}`;
                }).filter(Boolean).join('\n')
                : '  No se detectaron prerequisitos adicionales.';

            // Lista explícita de courseIds que DEBEN aparecer
            const mandatoryCourseIds = relevantCourses.map(c => c.id);

            // 8. Prompt del Planificador Pedagógico
            const prompt = `Eres un planificador académico experto de una academia preuniversitaria peruana.

═══════════════════════════════════════════════════
PERFIL DEL ESTUDIANTE:
- Nombre: ${user.name || 'Alumno'}
- Universidad objetivo: ${targetUniv}
- Carrera objetivo: ${career}

═══════════════════════════════════════════════════
DIAGNÓSTICO:

Fortalezas:
${strengthsText}

Debilidades:
${weaknessesText}

═══════════════════════════════════════════════════
SUB-GRAFO DE DEPENDENCIAS:
${graphText}

═══════════════════════════════════════════════════
CURSOS CON PESO > 0 PARA ${targetUniv}:

${courseCatalogText}

═══════════════════════════════════════════════════
INSTRUCCIONES ESTRICTAS:

1. DEBES incluir TODOS estos cursos en tu respuesta (son obligatorios para ${targetUniv}):
   ${JSON.stringify(mandatoryCourseIds)}

2. Asigna una prioridad numérica a cada curso (1 = más urgente).
   Fórmula: los cursos donde el alumno tiene debilidades Y peso alto → prioridad más alta.
   Los cursos donde el alumno es fuerte → prioridad más baja (pero SIGUEN apareciendo).

3. Para cada curso, lista TODOS sus tópicos en orden de estudio.
   - Respeta prerequisitos: un tema NUNCA va antes que sus dependencias.
   - Si un curso no tiene tópicos registrados, devuelve un array vacío de topicIds.
   - Usa EXCLUSIVAMENTE los topic IDs del catálogo. NO inventes IDs.

4. Devuelve EXCLUSIVAMENTE un JSON válido, sin bloques markdown.

FORMATO DE RESPUESTA EXACTO:
{
  "routes": [
    {
      "courseId": "course_xxx",
      "priority": 1,
      "topicIds": ["topic_aaa", "topic_bbb"]
    }
  ]
}
`;

            // 9. Llamada al Backend Proxy
            const response = await fetch(`${BACKEND_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error del servidor');

            // 10. Parsear respuesta
            let jsonString = data.text.trim();
            if (jsonString.startsWith('```')) {
                jsonString = jsonString.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim();
            }

            const aiPlan = JSON.parse(jsonString);

            // 11. Validar que TODOS los cursos obligatorios están presentes
            const returnedIds = new Set(aiPlan.routes.map(r => r.courseId));
            mandatoryCourseIds.forEach(cId => {
                if (!returnedIds.has(cId)) {
                    // La IA olvidó un curso → lo añadimos con prioridad baja
                    const cTopics = allTopics.filter(t => t.courseId === cId);
                    aiPlan.routes.push({
                        courseId: cId,
                        priority: 999,
                        topicIds: cTopics.map(t => t.id)
                    });
                }
            });

            // 12. Transformar al formato del frontend
            const roadmapCards = this._transformToFrontendFormat(
                aiPlan.routes, allCourses, allTopics, targetUniv
            );

            // 13. Guardar en localStorage
            localStorage.setItem(
                `eduquest_roadmap_${session.userId}`,
                JSON.stringify(roadmapCards)
            );

            console.log('[AIEngine] Rutas generadas:', roadmapCards.length, 'cursos');
            return roadmapCards;

        } catch (error) {
            console.error("[AIEngine] Error en la generación de rutas:", error);
            alert("Hubo un error al generar tus rutas. Revisa tu API Key o la conexión.");
            return this._generateFallback();
        }
    },

    // ─── Transformación al formato del frontend ─────────────────────
    _transformToFrontendFormat(routes, allCourses, allTopics, targetUniv) {
        return routes
            .sort((a, b) => a.priority - b.priority)
            .map(route => {
                const course = allCourses.find(c => c.id === route.courseId);
                if (!course) return null;

                const levels = route.topicIds
                    .map((tId, idx) => {
                        const topic = allTopics.find(t => t.id === tId);
                        if (!topic) return null;
                        return {
                            id: topic.id,
                            title: topic.name,
                            status: idx === 0 ? 'unlocked' : 'locked'
                        };
                    })
                    .filter(Boolean);

                return {
                    id: course.id,
                    name: course.name,
                    icon: course.icon,
                    color: course.color,
                    meta: `Ruta ${targetUniv}`,
                    progressPct: 0,
                    completedLevels: 0,
                    totalLevels: levels.length,
                    xpEarned: 0,
                    levels: levels
                };
            })
            .filter(Boolean);
    },

    // ─── Fallback ───────────────────────────────────────────────────
    _generateFallback() {
        const fallbackMap = [{
            id: "course_fallback",
            name: "Ruta de Nivelación General",
            icon: "🛡️",
            color: "#E24B4A",
            meta: "Ruta Básica",
            progressPct: 0,
            completedLevels: 0,
            totalLevels: 1,
            xpEarned: 0,
            levels: [{ id: "fallback_1", title: "Repaso General", status: "unlocked" }]
        }];
        const session = Storage.getSession();
        if (session) {
            localStorage.setItem(`eduquest_roadmap_${session.userId}`, JSON.stringify(fallbackMap));
        }
        return fallbackMap;
    }
};

window.AIEngine = AIEngine;
