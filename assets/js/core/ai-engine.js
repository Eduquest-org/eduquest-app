/**
 * @fileoverview Motor de Planificación Académica basado en Inteligencia Artificial.
 * Implementa una arquitectura de Cascade Prompting y Generación Aumentada por Recuperación (RAG).
 * 
 * Flujo de ejecución:
 * 1. Solicitud de prioridades de cursos al backend (/api/plan-priorities).
 * 2. Generación iterativa de estructuras de grafos (nodos y aristas) por curso mediante (/api/generate-route).
 * 3. Procesamiento asíncrono en segundo plano mediante un sistema de colas.
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

    /** Fase 2: RAG y Generación de Nodos por Curso */
    async _generateCourseNodes(course, priority, strengths, weaknesses, courseTopics) {
        const strengthsText = strengths.filter(s => s.courseId === course.id)
            .map(s => s.topicName).join(', ') || '';

        const weaknessesText = weaknesses.filter(w => w.courseId === course.id)
            .map(w => w.topicName).join(', ') || '';

        const topicsText = courseTopics.map(t => `- ${t.id}: ${t.name}`).join('\n');

        // Construir la consulta estructurada para el motor vectorial
        const queryText = `Curso: ${course.name}. Temas clave: ${courseTopics.map(t => t.name).join(', ')}. Debilidades del alumno: ${weaknessesText}. Fortalezas: ${strengthsText}.`;

        try {
            console.log(`[AIEngine] Solicitando nodos al backend (FASE 2) para curso: ${course.id}`);

            const session = await window.supabase?.auth?.getSession();
            const userId = session?.data?.session?.user?.id;

            // Enviar un payload estructurado en formato JSON al backend
            const payload = {
                userId: userId,
                courseId: course.id,
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

            // Analizar la respuesta serializada del backend
            const routeData = JSON.parse(data.text);

            return {
                courseId: course.id,
                priority: priority,
                nodes: routeData.nodes || [],
                edges: routeData.edges || []
            };

        } catch (err) {
            console.error(`[AIEngine] Error generando nodos para ${course.id}:`, err);
            return null; // Retorno de contingencia
        }
    },

    /** Punto de entrada principal */
    async generatePersonalizedRoadmap(diagnosticResults) {
        try {
            console.log('[AIEngine] Iniciando generación de rutas con Cascade Prompting Seguro (Backend)...');

            const [coursesRes, topicsRes, weightsRes] = await Promise.all([
                window.supabase.from('courses').select('*'),
                window.supabase.from('topics').select('*'),
                window.supabase.from('university_course_weights').select('*')
            ]);

            const allCourses = coursesRes.data || [];
            // Mapear identificadores para preservar la compatibilidad del motor
            const allTopics = (topicsRes.data || []).map(t => ({ ...t, courseId: t.course_id }));
            
            // Transformar el arreglo unidimensional de pesos al formato jerárquico esperado
            const allWeights = {};
            if (weightsRes.data) {
                weightsRes.data.forEach(w => {
                    if (!allWeights[w.university_id]) allWeights[w.university_id] = {};
                    allWeights[w.university_id][w.course_id] = w.weight;
                });
            }

            const userProfile = window.CurrentUserService ? window.CurrentUserService.getProfile() : {};
            const userId = userProfile?.id;
            const targetUniv = userProfile?.target_university_id || 'UNI';
            const career = userProfile?.career || 'Ingeniería';
            const userName = userProfile?.name || 'Alumno';

            const univWeights = allWeights[targetUniv] || allWeights['UNI'] || {};

            const relevantCourses = allCourses.filter(c => {
                const weight = univWeights[c.id];
                return weight !== undefined && weight > 0;
            });

            const { strengths, weaknesses } = this._analyzeDiagnostic(
                diagnosticResults, allTopics, allCourses
            );

            // Fase 1: Solicitar prioridades mediante el endpoint de enrutamiento
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

            // Fase 2: Iniciar la generación asíncrona de nodos
            console.log('[AIEngine] Fase 1 completada. Iniciando Fase 2: RAG paralelo por curso...');

            const sortedRelevantCourses = relevantCourses.map(c => ({
                course: c,
                priority: returnedPriorities.get(c.id) || 99
            })).sort((a, b) => a.priority - b.priority);

            const topCourses = sortedRelevantCourses.slice(0, 3);
            const restCourses = sortedRelevantCourses.slice(3);

            // Preparar el estado inicial para el procesamiento asíncrono
            const aiQueue = topCourses.map(entry => {
                const cTopics = allTopics.filter(t => t.courseId === entry.course.id);
                return {
                    course: entry.course,
                    priority: entry.priority,
                    topics: cTopics,
                    strengths: strengths,
                    weaknesses: weaknesses
                };
            });

            // Generar una estructura temporal de respaldo para preservar la visibilidad de los cursos en la interfaz de usuario
            const initialRoutes = sortedRelevantCourses.map((entry, index) => {
                const cTopics = allTopics.filter(t => t.courseId === entry.course.id);
                const sortedTopics = this._topologicalSort(cTopics);
                const isLockedCourse = index >= 3;

                const nodes = sortedTopics.map(t => ({
                    id: `node_${t.id}`,
                    type: "nivel",
                    data: {
                        title: t.name,
                        isLocked: isLockedCourse,
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
                    isLocked: isLockedCourse,
                    nodes: nodes,
                    edges: edges
                };
            });

            // Transformar la estructura al formato de presentación y persistir los cambios
            const roadmapCards = this._transformToFrontendFormat(initialRoutes, allCourses, targetUniv);
            if (userId) {
                UserManager.updateProfile(userId, { ai_roadmap: roadmapCards });
                if (window.CurrentUserService && window.CurrentUserService.getProfile()) {
                    window.CurrentUserService.getProfile().ai_roadmap = roadmapCards;
                }
            }

            // Persistir el estado de la cola en el almacenamiento local
            localStorage.setItem('aiQueue', JSON.stringify(aiQueue));
            localStorage.setItem('aiResults', JSON.stringify(initialRoutes));

            // Iniciar el procesamiento asíncrono de la cola
            console.log('[AIEngine] Cola preparada con', aiQueue.length, 'cursos. Iniciando processQueue() en segundo plano...');
            this.processQueue();

            return initialRoutes;

        } catch (error) {
            console.error("[AIEngine] Error crítico en la generación de rutas:", error);
            alert("Hubo un error al generar las rutas mediante la IA. Aplicando el plan de respaldo.");
            return this._generateFallback();
        }
    },

    /** Procesamiento asíncrono en segundo plano */
    async processQueue() {
        // Establecer un mecanismo de bloqueo mutuo para evitar ejecuciones concurrentes de la cola
        if (window._isProcessingAIQueue) return;
        window._isProcessingAIQueue = true;

        try {
            // Validar la existencia de procesos pendientes
            const queueStr = localStorage.getItem('aiQueue');
            if (!queueStr) return;

            const queue = JSON.parse(queueStr);
            if (queue.length === 0) {
                // Finalizar el ciclo al confirmar que la cola está vacía
                localStorage.removeItem('aiQueue');
                console.log('[AIEngine] Cola de generación finalizada exitosamente.');

                // Renderizar notificación global de finalización
                if (window.app && window.app.showToast) {
                    window.app.showToast('El procesamiento de la ruta inteligente ha finalizado de forma satisfactoria.', 'success');
                } else {
                    alert('El procesamiento de la ruta inteligente ha finalizado de forma satisfactoria.');
                }

                // Actualizar la interfaz de usuario si la vista de rutas está activa
                if (window.location.pathname.includes('roadmap.html') && window.refreshRoadmapUI) {
                    window.refreshRoadmapUI();
                }
                return;
            }

            // Extraer el elemento prioritario de la cola
            const currentTask = queue[0];
            console.log(`[AIEngine] Procesando curso en background: ${currentTask.course.name}...`);

            try {
                // Procesar la ruta correspondiente al curso seleccionado
                const route = await this._generateCourseNodes(
                    currentTask.course,
                    currentTask.priority,
                    currentTask.strengths,
                    currentTask.weaknesses,
                    currentTask.topics
                );

                // Invocar una excepción intencional ante un fallo del servicio para inducir un reintento
                if (!route) {
                    throw new Error("Generación fallida o rate limit excedido. Ejecutando protocolo de reintento.");
                }

                // Recuperar el listado de resultados generados previamente
                let aiResults = JSON.parse(localStorage.getItem('aiResults') || '[]');

                // Anexar o actualizar la ruta procesada en el registro de resultados
                const existingIdx = aiResults.findIndex(r => r.courseId === route.courseId);
                if (existingIdx !== -1) {
                    aiResults[existingIdx] = route;
                } else {
                    aiResults.push(route);
                }

                // Extraer inmediatamente el curso procesado para garantizar el progreso de la cola
                queue.shift();
                localStorage.setItem('aiQueue', JSON.stringify(queue));

                // Aplicar formato de presentación y registrar el avance del usuario
                const userProfile = window.CurrentUserService ? window.CurrentUserService.getProfile() : null;
                if (userProfile && window.UserManager) {
                    const coursesRes = await window.supabase.from('courses').select('*');
                    const allCourses = coursesRes.data || [];

                    let targetUniv = "UNI";
                    if (window.CurrentUserService) {
                        targetUniv = window.CurrentUserService.getStat('target') || "UNI";
                    }

                    const roadmapCards = this._transformToFrontendFormat(aiResults, allCourses, targetUniv);
                    window.UserManager.updateProfile(userProfile.id, { ai_roadmap: roadmapCards });
                    if (window.CurrentUserService && window.CurrentUserService.getProfile()) {
                        window.CurrentUserService.getProfile().ai_roadmap = roadmapCards;
                    }

                    // Actualizar el estado de resultados para el siguiente ciclo
                    localStorage.setItem('aiResults', JSON.stringify(aiResults));

                    // Recargar la vista de rutas para reflejar el estado actual del procesamiento
                    if (window.location.pathname.includes('roadmap.html') && window.refreshRoadmapUI) {
                        window.refreshRoadmapUI();
                    }

                    // Invocar el siguiente ciclo de la cola tras un retraso preventivo por límites de peticiones
                    setTimeout(() => this.processQueue(), 10000);
                } else {
                    // Continuar el procesamiento independientemente del estado del perfil
                    setTimeout(() => this.processQueue(), 2000);
                }

            } catch (error) {
                console.error(`[AIEngine] Error procesando ${currentTask.course.name} en background:`, error);
                // Programar un reintento diferido tras un error de ejecución
                setTimeout(() => this.processQueue(), 20000);
            }
        } finally {
            // Liberar el bloqueo de ejecución
            window._isProcessingAIQueue = false;
        }
    },

    /** Transformar a formato de presentación */
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
                    isLocked: route.isLocked || false,
                    nodes: route.nodes || [],
                    edges: route.edges || []
                };
            })
            .filter(Boolean);
    },

    /** Generador de rutas de respaldo (Fallback) */
    _generateFallback() {
        const fallbackMap = [{
            id: "course_fallback",
            name: "Ruta de Nivelación General",
            icon: "📚", // Placeholder estandar
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
        const userProfile = window.CurrentUserService ? window.CurrentUserService.getProfile() : null;
        if (userProfile) {
            UserManager.updateProfile(userProfile.id, { ai_roadmap: fallbackMap });
            if (window.CurrentUserService && window.CurrentUserService.getProfile()) {
                window.CurrentUserService.getProfile().ai_roadmap = fallbackMap;
            }
        }
        return fallbackMap;
    }
};

window.AIEngine = AIEngine;
