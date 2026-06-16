/**
 * AIEngine — Motor de Planificación Académica.
 *
 * Arquitectura (Cascade Prompting & RAG):
 * - FASE 1: Se envía un prompt global para obtener la PRIORIDAD de los cursos basándose en el perfil.
 * - FASE 2: Por cada curso relevante, se envía un prompt inyectando contexto RAG (Recursos) 
 *           para generar una estructura de Nodos y Aristas por Tema.
 */

const BACKEND_URL = 'https://backend-eta-ten-99.vercel.app';

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
    async _generateCourseNodes(course, priority, strengths, weaknesses, courseTopics, allResources) {
        // 1. Ya no recuperamos los recursos localmente, el Backend (Pinecone) lo hará.

        const strengthsText = strengths.filter(s => s.courseId === course.id)
            .map(s => s.topicName).join(', ') || 'Ninguna específica.';

        const weaknessesText = weaknesses.filter(w => w.courseId === course.id)
            .map(w => w.topicName).join(', ') || 'Ninguna específica.';

        const topicsText = courseTopics.map(t => `- ${t.id}: ${t.name}`).join('\n');

        // Construir el query textual para buscar en la base de datos vectorial
        const queryText = `Curso: ${course.name}. Temas clave: ${courseTopics.map(t=>t.name).join(', ')}. Debilidades del alumno: ${weaknessesText}. Fortalezas: ${strengthsText}.`;

        // 2. Prompt Fase 2 (RAG Inyectado)
        const prompt = `Eres un arquitecto de rutas de aprendizaje de nivel experto. 
Tu tarea es diseñar la estructura interna de los nodos (temas) para el curso de: ${course.name}.

PERFIL DEL USUARIO EN ESTE CURSO:
- Fortalezas: ${strengthsText}
- Debilidades: ${weaknessesText}

CATÁLOGO DE RECURSOS RECUPERADOS (RAG):
A continuación tienes los únicos recursos validados que puedes utilizar. NO inventes recursos que no estén en esta lista:
{RAG_CONTEXT}

TEMAS DEL CURSO (Nodos a generar):
${topicsText}

INSTRUCCIONES:
Para cada Tema listado, debes construir un nodo. La estructura interna obligatoria del "content" de cada nodo es:
1. lecciones
2. recursos
3. quiz
4. examen
5. desafio_final

- Si el usuario tiene una "Debilidad" en un tema, asígnale más lecciones (si hay disponibles en el catálogo).
- Si tiene una "Fortaleza", ve directo a un repaso rápido y enfócate en el Examen y Desafío Final.
- Asigna los IDs y Títulos exactos del catálogo. Si no hay recurso para una categoría, deja el arreglo vacío [].
- Para las conexiones ("edges"), respeta la progresión lógica de aprendizaje uniendo los nodos generados de forma secuencial.

FORMATO DE SALIDA (STRICT JSON SCHEMA):
Debes devolver EXCLUSIVAMENTE este JSON:
{
  "nodes": [
    {
      "id": "node_{TOPIC_ID}",
      "type": "nivel",
      "data": {
         "title": "{TOPIC_NAME}",
         "content": {
            "lecciones": [{"id": "{RES_ID}", "title": "{RES_TITLE}"}],
            "recursos": [],
            "quiz": [],
            "examen": [],
            "desafio_final": []
         }
      }
    }
  ],
  "edges": [
    {"source": "node_{TOPIC_ID_1}", "target": "node_{TOPIC_ID_2}"}
  ]
}
`;

        try {
            console.log(`[AIEngine] Solicitando nodos RAG REAL para curso: ${course.id}`);
            const response = await fetch(`${BACKEND_URL}/api/generate-route`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, queryText })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error del servidor');

            let jsonString = data.text.trim();
            if (jsonString.startsWith('```')) {
                jsonString = jsonString.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim();
            }

            const routeData = JSON.parse(jsonString);
            return {
                courseId: course.id,
                priority: priority,
                nodes: routeData.nodes || [],
                edges: routeData.edges || []
            };

        } catch (err) {
            console.error(`[AIEngine] Error generando nodos para ${course.id}:`, err);
            return null; // El frontend lidiará con los fallos omitiendo el curso o usando fallback local
        }
    },

    // ─── Punto de entrada ───────────────────────────────────────────
    async generatePersonalizedRoadmap(diagnosticResults) {
        try {
            console.log('[AIEngine] Iniciando generación de rutas con Cascade Prompting...');

            // Cargar catálogo completo + pesos + simulador de base vectorial (RAG)
            const [coursesRes, topicsRes, weightsRes, resourcesRes] = await Promise.all([
                fetch('../../mock/courses.json'),
                fetch('../../mock/topics.json'),
                fetch('../../mock/university-weights.json'),
                fetch('../../mock/resources.json').catch(() => ({ json: () => [] })) // Fallback si no existe
            ]);

            const allCourses = await coursesRes.json();
            const allTopics = await topicsRes.json();
            const allWeights = await weightsRes.json();
            let allResources = [];
            try {
                allResources = await resourcesRes.json();
            } catch (e) {
                console.warn("[AIEngine] mock/resources.json no pudo parsearse o no existe aún.");
            }

            const session = Storage.getSession();
            const user = UserManager.getCurrentUserDoc() || {};
            const targetUniv = (user.profile && user.profile.target) || 'UNI';
            const career = (user.profile && user.profile.career) || 'Ingeniería';

            const univWeights = allWeights[targetUniv] || allWeights['UNI'] || {};

            const relevantCourses = allCourses.filter(c => {
                const weight = univWeights[c.id];
                return weight !== undefined && weight > 0;
            });

            const { strengths, weaknesses } = this._analyzeDiagnostic(
                diagnosticResults, allTopics, allCourses
            );

            // FASE 1: PROMPT ENRUTADOR (Prioridad)
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

            const promptFase1 = `Eres un planificador académico experto para exámenes de admisión en Perú.
            
PERFIL DEL ESTUDIANTE:
- Nombre: ${user.name || 'Alumno'}
- Universidad objetivo: ${targetUniv}
- Carrera: ${career}

RESULTADOS DEL DIAGNÓSTICO:
Fortalezas:
${strengthsText}

Debilidades:
${weaknessesText}

CURSOS DISPONIBLES Y SU PESO PARA ${targetUniv}:
${courseCatalogText}

INSTRUCCIONES ESTRICTAS:
1. Asigna un nivel de prioridad (entero de 1 a 10, donde 1 es la prioridad más alta) a cada curso.
2. Devuelve EXCLUSIVAMENTE un JSON válido que contenga la prioridad de cada curso.

FORMATO DE RESPUESTA EXACTO:
{
  "coursePriorities": [
    { "courseId": "course_xxx", "priority": 1 }
  ]
}
`;

            const responseFase1 = await fetch(`${BACKEND_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: promptFase1 })
            });

            const dataFase1 = await responseFase1.json();
            if (!responseFase1.ok) throw new Error(dataFase1.error || 'Error del servidor');

            let jsonString = dataFase1.text.trim();
            if (jsonString.startsWith('```')) {
                jsonString = jsonString.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim();
            }

            const aiPlan = JSON.parse(jsonString);
            const coursePriorities = aiPlan.coursePriorities || [];
            const returnedPriorities = new Map(coursePriorities.map(p => [p.courseId, p.priority]));

            // FASE 2: GENERACIÓN DE NODOS (RAG EN PARALELO)
            console.log('[AIEngine] Fase 1 completada. Iniciando Fase 2: RAG paralelo por curso...');

            // Limitaremos temporalmente la cantidad de llamadas en paralelo a los 3 cursos más prioritarios
            // para no saturar la API key gratuita de Gemini si es que se usa así.
            // Los demás usarán un formato fallback local o se generarán vacíos temporalmente.
            const sortedRelevantCourses = relevantCourses.map(c => ({
                course: c,
                priority: returnedPriorities.get(c.id) || 99
            })).sort((a, b) => a.priority - b.priority);

            // Seleccionamos el top 3 para procesar con IA compleja
            const topCourses = sortedRelevantCourses.slice(0, 3);
            const restCourses = sortedRelevantCourses.slice(3);

            const aiRoutesPromises = topCourses.map(entry => {
                const cTopics = allTopics.filter(t => t.courseId === entry.course.id);
                return this._generateCourseNodes(entry.course, entry.priority, strengths, weaknesses, cTopics, allResources);
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
                for(let i=0; i < nodes.length - 1; i++){
                    edges.push({ source: nodes[i].id, target: nodes[i+1].id });
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

                // Ahora los niveles ya no son solo un ID simple, contienen la estructura de Nodos (Grafo)
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
