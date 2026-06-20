/**
 * AIEngine — Motor de Planificación Académica.
 *
 * Arquitectura (Cascade Prompting & RAG):
 * - FASE 1: Se envía un JSON al backend (/api/plan-priorities) para obtener la PRIORIDAD de los cursos.
 * - FASE 2: Por cada curso relevante, se envía un JSON al backend (/api/generate-route) 
 *           para generar una estructura de Nodos y Aristas por Tema inyectando RAG.
 */

const BACKEND_URL = 'https://eduquest-backend-delta.vercel.app';

const AIEngine = {

    _topologicalSort(topics) {
        const sorted = [];
        const visited = new Set();
        const temp = new Set();

        const visit = (topicId) => {
            if (temp.has(topicId)) return;
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

    // ─── FASE 2: RAG y Generación de Nodos por Curso ───────────────
    async _generateCourseNodes(course, priority, strengths, weaknesses, courseTopics) {
        const strengthsText = strengths.filter(s => s.courseId === course.id)
            .map(s => s.topicName).join(', ') || '';

        const weaknessesText = weaknesses.filter(w => w.courseId === course.id)
            .map(w => w.topicName).join(', ') || '';

        const topicsText = courseTopics.map(t => `- ${t.id}: ${t.name}`).join('\n');

        // Construir el query textual para buscar en la base de datos vectorial
        const queryText = `Curso: ${course.name}. Temas clave: ${courseTopics.map(t => t.name).join(', ')}. Debilidades del alumno: ${weaknessesText}. Fortalezas: ${strengthsText}.`;

        try {
            console.log(`[AIEngine] Solicitando nodos al backend (FASE 2) para curso: ${course.id}`);

            // Enviamos un payload limpio (JSON estructurado) al backend en vez del gran Prompt
            const payload = {
                courseName: course.name,
                strengthsText: strengthsText,
                weaknessesText: weaknessesText,
                topicsText: topicsText,
                queryText: queryText
            };

            const response = await fetch(`${BACKEND_URL}/api/generate-route`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error del servidor en Fase 2');

            // El backend ya devuelve el texto en crudo del JSON generado
            const routeData = JSON.parse(data.text);

            return {
                courseId: course.id,
                priority: priority,
                nodes: routeData.nodes || [],
                edges: routeData.edges || []
            };

        } catch (err) {
            console.error(`[AIEngine] Error generando nodos para ${course.id}:`, err);
            return null; // Fallback: se omitirá o se generará localmente
        }
    },

    // ─── Punto de entrada ───────────────────────────────────────────
    async generatePersonalizedRoadmap(diagnosticResults) {
        try {
            console.log('[AIEngine] Iniciando generación de rutas con Cascade Prompting Seguro (Backend)...');

            const [coursesRes, topicsRes, weightsRes] = await Promise.all([
                fetch('../../mock/courses.json'),
                fetch('../../mock/topics.json'),
                fetch('../../mock/university-weights.json')
            ]);

            const allCourses = await coursesRes.json();
            const allTopics = await topicsRes.json();
            const allWeights = await weightsRes.json();

            const session = Storage.getSession();
            const user = UserManager.getCurrentUserDoc() || {};
            const targetUniv = (user.profile && user.profile.target) || 'UNI';
            const career = (user.profile && user.profile.career) || 'Ingeniería';
            const userName = user.name || 'Alumno';

            const univWeights = allWeights[targetUniv] || allWeights['UNI'] || {};

            const relevantCourses = allCourses.filter(c => {
                const weight = univWeights[c.id];
                return weight !== undefined && weight > 0;
            });

            const { strengths, weaknesses } = this._analyzeDiagnostic(
                diagnosticResults, allTopics, allCourses
            );

            // FASE 1: PROMPT ENRUTADOR (Prioridad) - Ahora llamando al nuevo endpoint
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

            const payloadFase1 = {
                userName: userName,
                targetUniv: targetUniv,
                career: career,
                strengthsText: strengthsText,
                weaknessesText: weaknessesText,
                courseCatalogText: courseCatalogText
            };

            const responseFase1 = await fetch(`${BACKEND_URL}/api/plan-priorities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadFase1)
            });

            const dataFase1 = await responseFase1.json();
            if (!responseFase1.ok) throw new Error(dataFase1.error || 'Error del servidor en Fase 1');

            const aiPlan = JSON.parse(dataFase1.text);
            const coursePriorities = aiPlan.coursePriorities || [];
            const returnedPriorities = new Map(coursePriorities.map(p => [p.courseId, p.priority]));

            // FASE 2: GENERACIÓN DE NODOS (RAG EN PARALELO)
            console.log('[AIEngine] Fase 1 completada. Iniciando Fase 2: RAG paralelo por curso...');

            const sortedRelevantCourses = relevantCourses.map(c => ({
                course: c,
                priority: returnedPriorities.get(c.id) || 99
            })).sort((a, b) => a.priority - b.priority);

            const topCourses = sortedRelevantCourses.slice(0, 3);
            const restCourses = sortedRelevantCourses.slice(3);

            const aiRoutesPromises = topCourses.map(entry => {
                const cTopics = allTopics.filter(t => t.courseId === entry.course.id);
                return this._generateCourseNodes(entry.course, entry.priority, strengths, weaknesses, cTopics);
            });

            const generatedTopRoutes = (await Promise.all(aiRoutesPromises)).filter(Boolean);

            // Para el resto de cursos (no Top 3), generamos una estructura local simplificada (Fallback)
            const fallbackRoutes = restCourses.map(entry => {
                const cTopics = allTopics.filter(t => t.courseId === entry.course.id);
                const sortedTopics = this._topologicalSort(cTopics);

                const nodes = sortedTopics.map(t => ({
                    id: `node_${t.id}`,
                    type: "nivel",
                    data: {
                        title: t.name,
                        content: { lecciones: [], recursos: [], quiz: [], examen: [], desafio_final: [] }
                    }
                }));

                const edges = [];
                for (let i = 0; i < nodes.length - 1; i++) {
                    edges.push({ source: nodes[i].id, target: nodes[i + 1].id });
                }

                return {
                    courseId: entry.course.id,
                    priority: entry.priority,
                    nodes: nodes,
                    edges: edges
                };
            });

            const allRoutes = [...generatedTopRoutes, ...fallbackRoutes];

            // 12. Transformar al formato del frontend
            const roadmapCards = this._transformToFrontendFormat(
                allRoutes, allCourses, targetUniv
            );

            // 13. Guardar en el documento del usuario
            UserManager.saveCustomRoadmap(session.userId, roadmapCards);

            console.log('[AIEngine] Rutas generadas exitosamente:', roadmapCards.length, 'cursos');
            return roadmapCards;

        } catch (error) {
            console.error("[AIEngine] Error crítico en la generación de rutas:", error);
            alert("Hubo un error al generar tus rutas mediante IA. Usando plan de respaldo.");
            return this._generateFallback();
        }
    },

    // ─── Transformación al formato del frontend ─────────────────────
    _transformToFrontendFormat(routes, allCourses, targetUniv) {
        return routes
            .sort((a, b) => a.priority - b.priority)
            .map(route => {
                const course = allCourses.find(c => c.id === route.courseId);
                if (!course) return null;

                return {
                    id: course.id,
                    name: course.name,
                    icon: course.icon,
                    color: course.color,
                    meta: `Ruta ${targetUniv}`,
                    progressPct: 0,
                    completedLevels: 0,
                    totalLevels: route.nodes ? route.nodes.length : 0,
                    xpEarned: 0,
                    nodes: route.nodes || [],
                    edges: route.edges || []
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
            nodes: [{
                id: "node_fallback_1",
                type: "nivel",
                data: {
                    title: "Repaso General",
                    content: { lecciones: [], recursos: [], quiz: [], examen: [], desafio_final: [] }
                }
            }],
            edges: []
        }];
        const session = Storage.getSession();
        if (session) {
            UserManager.saveCustomRoadmap(session.userId, fallbackMap);
        }
        return fallbackMap;
    }
};

window.AIEngine = AIEngine;
