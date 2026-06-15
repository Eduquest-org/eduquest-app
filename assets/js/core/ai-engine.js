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
const BACKEND_URL = 'https://backend-eta-ten-99.vercel.app';

const AIEngine = {

    // ─── Topological Sort ───────────────────────────────────────────
    _topologicalSort(topics) {
        const sorted = [];
        const visited = new Set();
        const temp = new Set();

        const visit = (topicId) => {
            if (temp.has(topicId)) return; // Ciclo detectado o ya en procesamiento
            if (visited.has(topicId)) return;

            temp.add(topicId);

            const topic = topics.find(t => t.id === topicId);
            if (topic) {
                if (topic.prerequisites && topic.prerequisites.length > 0) {
                    topic.prerequisites.forEach(reqId => {
                        if (topics.some(t => t.id === reqId)) {
                            visit(reqId);
                        }
                    });
                }
                sorted.push(topic);
            }

            temp.delete(topicId);
            visited.add(topicId);
        };

        topics.forEach(t => visit(t.id));
        return sorted;
    },

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
            // Cargar catálogo completo + pesos
            const [coursesRes, topicsRes, weightsRes] = await Promise.all([
                fetch('../../mock/courses.json'),
                fetch('../../mock/topics.json'),
                fetch('../../mock/university-weights.json')
            ]);
            const allCourses = await coursesRes.json();
            const allTopics = await topicsRes.json();
            const allWeights = await weightsRes.json();

            // Obtener perfil del usuario
            const session = Storage.getSession();
            const users = JSON.parse(localStorage.getItem('eduquest_db_users')) || [];
            const user = users.find(u => u.id === session.userId) || {};
            const targetUniv = user.target || 'UNI';
            const career = user.career || 'Ingeniería';

            // Obtener pesos para la universidad objetivo
            const univWeights = allWeights[targetUniv] || allWeights['UNI'] || {};

            // SELECCIÓN DETERMINÍSTICA: todos los cursos con peso > 0
            const relevantCourses = allCourses.filter(c => {
                const weight = univWeights[c.id];
                return weight !== undefined && weight > 0;
            });

            // Analizar diagnóstico
            const { strengths, weaknesses } = this._analyzeDiagnostic(
                diagnosticResults, allTopics, allCourses
            );

            // Expandir debilidades con prerequisitos 
            const weakTopicIds = weaknesses.map(w => w.topicId);
            const requiredTopicIds = this._buildSubGraph(weakTopicIds, allTopics);

            // Construir el catálogo de cursos y sus pesos para el prompt (simplificado, sin tópicos)
            const courseCatalogText = relevantCourses.map(c => {
                const weight = univWeights[c.id] || 0;
                return `- ${c.id}: "${c.name}" (Peso de admisión: ${weight}/100)`;
            }).join('\n');

            const strengthsText = strengths.length > 0
                ? strengths.map(s => `  ✓ ${s.topicName} (${s.courseName})`).join('\n')
                : '  Ninguna detectada en este diagnóstico.';

            const weaknessesText = weaknesses.length > 0
                ? weaknesses.map(w => `  ✗ ${w.topicName} (${w.courseName})`).join('\n')
                : '  Ninguna detectada en este diagnóstico.';

            // 8. Prompt del Planificador Pedagógico Simplificado
            const prompt = `Eres un planificador académico experto para exámenes de admisión en Perú.
            
PERFIL DEL ESTUDIANTE:
- Nombre: ${user.name || 'Alumno'}
- Universidad objetivo: ${targetUniv}
- Carrera: ${career}

RESULTADOS DEL DIAGNÓSTICO:
Fortalezas (temas superados):
${strengthsText}

Debilidades (temas con fallas):
${weaknessesText}

CURSOS DISPONIBLES Y SU PESO PARA ${targetUniv}:
${courseCatalogText}

INSTRUCCIONES ESTRICTAS:
1. Asigna un nivel de prioridad (entero de 1 a 10, donde 1 es la prioridad más alta y urgente) a cada curso.
2. Consideración clave:
   - Prioridad 1 a 3 (Alta): Cursos con alto peso de admisión en los que el alumno tiene debilidades.
   - Prioridad 4 a 7 (Media): Cursos con peso medio o en los que no se han detectado debilidades fuertes.
   - Prioridad 8 a 10 (Baja): Cursos con bajo peso o en los que el alumno demostró fortalezas claras.
3. Devuelve EXCLUSIVAMENTE un JSON válido que contenga la prioridad de cada curso. No incluyas explicaciones ni bloques de código Markdown (\`\`\`json).

FORMATO DE RESPUESTA EXACTO:
{
  "coursePriorities": [
    {
      "courseId": "course_xxx",
      "priority": 1
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
            const coursePriorities = aiPlan.coursePriorities || [];
            const returnedPriorities = new Map(coursePriorities.map(p => [p.courseId, p.priority]));

            // 11. Reconstruir routes cruzando las prioridades de la IA y los temas ordenados localmente
            const routes = [];
            relevantCourses.forEach(c => {
                let priority = returnedPriorities.get(c.id);
                if (priority === undefined) {
                    priority = 99; // Fallback para cursos no devueltos por la IA
                }

                // Filtrar tópicos del curso y ordenarlos usando el ordenamiento topológico local
                const cTopics = allTopics.filter(t => t.courseId === c.id);
                const sortedTopics = this._topologicalSort(cTopics);
                const topicIds = sortedTopics.map(t => t.id);

                routes.push({
                    courseId: c.id,
                    priority: priority,
                    topicIds: topicIds
                });
            });

            // 12. Transformar al formato del frontend
            const roadmapCards = this._transformToFrontendFormat(
                routes, allCourses, allTopics, targetUniv
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
