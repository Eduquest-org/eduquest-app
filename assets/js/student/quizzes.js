/**
 * @fileoverview Controlador principal de evaluación y simulacros.
 * Gestiona el ciclo de vida de los cuestionarios, temporización, calificación,
 * asignación de puntos de experiencia (XP) y persistencia del progreso académico.
 */
import { CoursesManager } from '../core/courses-manager.js';
import { TopicsManager } from '../core/topics-manager.js';
import { ProblemsManager } from '../core/problems-manager.js';

let activeQuizState = {
    problems: [],
    currentIdx: 0,
    answers: [], // Almacenar selección de respuesta por índice
    startTime: null,
    timerInterval: null,
    topic_id: null,
    course_id: null,
    title: "",
    xpReward: 150,
    isGeneral: false
};

document.addEventListener("DOMContentLoaded", async () => {
    // Inicializar catálogo de evaluaciones
    await loadQuizzesSelection();

    // Evaluar parámetros de inicialización automática desde URL
    const params = new URLSearchParams(window.location.search);
    const topicParam = params.get("level");
    const typeParam = params.get("type");

    if (topicParam) {
        startQuizFromParam(topicParam, typeParam);
    } else {
        // Ocultar preloader en ausencia de inicio automático
        const loader = document.getElementById("app-preloader");
        if (loader) {
            loader.style.opacity = "0";
            setTimeout(() => loader.remove(), 400);
        }
    }
});

/** Renderizar catálogo de cursos y temas disponibles para evaluación */
async function loadQuizzesSelection() {
    const grid = document.getElementById("courses-quizzes-grid");
    if (!grid) return;

    try {
        const [courses, topics] = await Promise.all([
            CoursesManager.getCourses(),
            TopicsManager.getAllTopics()
        ]);

        // Consultar registro de temas completados
        let completedTopics = [];
        const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
        if (user && user.learningProgress) {
            completedTopics = user.learningProgress.completedTopics || [];
        }

        grid.innerHTML = "";

        courses.forEach(course => {
            const courseTopics = topics.filter(t => t.course_id === course.id);
            if (courseTopics.length === 0) return; // Excluir cursos carentes de temario

            const card = document.createElement("div");
            card.className = "course-quiz-card";
            card.setAttribute("data-category", course.category || "Matemáticas");

            let topicsHTML = "";
            courseTopics.forEach(topic => {
                const isDone = completedTopics.includes(topic.id);
                topicsHTML += `
                    <div class="topic-quiz-row ${isDone ? 'completed' : ''}">
                        <div class="topic-info-side">
                            <span class="topic-name">${topic.name}</span>
                            <span class="topic-xp-tag">+100 XP</span>
                        </div>
                        <button class="btn-start-topic-quiz" title="${isDone ? 'Superado. Volver a practicar' : 'Iniciar Práctica'}" onclick="startSpecificQuiz('${topic.id}', '${topic.name}', '${course.id}', 100)"></button>
                    </div>
                `;
            });

            card.innerHTML = `
                <div class="course-quiz-header">
                    <div class="course-quiz-icon" style="background: ${course.color}">${course.icon}</div>
                    <div class="course-quiz-title">
                        <h3>${course.name}</h3>
                        <span>${course.category || "Matemáticas"}</span>
                    </div>
                </div>
                <div class="course-topics-list">
                    ${topicsHTML}
                </div>
            `;

            grid.appendChild(card);
        });

    } catch (error) {
        console.error("Error cargando selección de cuestionarios:", error);
    }
}

/** Filtrar catálogo por categoría académica */
function filterCourses(category, buttonEl) {
    // Actualizar estado visual del filtro
    document.querySelectorAll(".filter-chip").forEach(chip => chip.classList.remove("active"));
    buttonEl.classList.add("active");

    const cards = document.querySelectorAll(".course-quiz-card");
    cards.forEach(card => {
        const cardCat = card.getAttribute("data-category");
        if (category === "todos" || cardCat === category) {
            card.style.display = "flex";
        } else {
            card.style.display = "none";
        }
    });
}

/** Inicializar evaluación paramétrica basada en ruta de aprendizaje */
async function startQuizFromParam(topic_id, type) {
    try {
        const topics = await TopicsManager.getAllTopics();

        const topic = topics.find(t => t.id === topic_id);
        if (topic) {
            startSpecificQuiz(topic.id, topic.name, topic.course_id, type === 'examen' ? 200 : 100);
        } else {
            // Ejecutar evaluación general como respaldo ante falla de identificación
            alert("No se encontró el tema solicitado. Iniciando evaluación general.");
            startGeneralMockExam();
        }
    } catch (e) {
        console.error("Error auto-iniciando quiz:", e);
    }
}

/** Iniciar evaluación específica por tema */
async function startSpecificQuiz(topic_id, topicName, course_id, xpReward) {
    showPreloader("Generando banco de preguntas específico...");

    try {
        const allProblems = await ProblemsManager.getAllProblems();

        // Filtrar banco de preguntas por identificador temático
        let filtered = allProblems.filter(p => p.topic_id === topic_id);

        if (filtered.length === 0) {
            // Ejecutar búsqueda difusa por prefijo de curso
            const coursePrefix = topic_id.split("_")[1];
            filtered = allProblems.filter(p => p.id && p.id.includes(`_${coursePrefix}_`));
        }

        if (filtered.length === 0) {
            // Selección de contingencia de preguntas
            filtered = allProblems.slice(0, 5);
        }

        // Extraer subconjunto aleatorio de preguntas
        const shuffle = arr => arr.sort(() => 0.5 - Math.random());
        const selectedProblems = shuffle([...filtered]).slice(0, 5);

        activeQuizState = {
            problems: selectedProblems,
            currentIdx: 0,
            answers: new Array(selectedProblems.length).fill(null),
            startTime: Date.now(),
            topic_id: topic_id,
            course_id: course_id,
            title: `Evaluación: ${topicName}`,
            xpReward: xpReward || 100,
            isGeneral: false
        };

        hidePreloader();
        launchQuizRunner();

    } catch (error) {
        console.error("Error iniciando evaluación de tema:", error);
        hidePreloader();
        alert("Ocurrió un error inicializando el banco de preguntas.");
    }
}

/** Iniciar evaluación general combinada */
async function startGeneralMockExam() {
    showPreloader("Compilando evaluación general estructurada...");

    try {
        const allProblems = await ProblemsManager.getAllProblems();

        // Segmentar preguntas por aptitud académica
        const rm = allProblems.filter(p => p.id && p.id.includes("prob_rm_"));
        const rv = allProblems.filter(p => p.id && (p.id.includes("prob_rv_") || p.id.includes("prob_lect_")));

        const shuffle = arr => arr.sort(() => 0.5 - Math.random());
        const selected = [...shuffle(rm).slice(0, 5), ...shuffle(rv).slice(0, 5)];

        activeQuizState = {
            problems: selected,
            currentIdx: 0,
            answers: new Array(selected.length).fill(null),
            startTime: Date.now(),
            topic_id: null,
            course_id: null,
            title: "Simulacro General Integral",
            xpReward: 300,
            isGeneral: true
        };

        hidePreloader();
        launchQuizRunner();

    } catch (error) {
        console.error("Error iniciando simulacro general:", error);
        hidePreloader();
    }
}

/** Transicionar a vista de ejecución de evaluación */
function launchQuizRunner() {
    document.querySelectorAll(".quiz-view-section").forEach(v => v.classList.remove("active"));
    document.getElementById("quiz-runner-view").classList.add("active");

    // Reinicializar interfaz de usuario
    document.getElementById("quiz-run-title").innerText = activeQuizState.title;

    // Inicializar temporizador de ejecución
    if (activeQuizState.timerInterval) clearInterval(activeQuizState.timerInterval);
    activeQuizState.startTime = Date.now();
    updateTimerText();
    activeQuizState.timerInterval = setInterval(updateTimerText, 1000);

    renderCurrentQuestion();
}

function updateTimerText() {
    const elapsedSecs = Math.floor((Date.now() - activeQuizState.startTime) / 1000);
    const mins = Math.floor(elapsedSecs / 60).toString().padStart(2, "0");
    const secs = (elapsedSecs % 60).toString().padStart(2, "0");
    document.getElementById("quiz-timer").innerText = `⏱️ ${mins}:${secs}`;
}

/** Renderizar la pregunta activa en la interfaz */
function renderCurrentQuestion() {
    const idx = activeQuizState.currentIdx;
    const total = activeQuizState.problems.length;
    const q = activeQuizState.problems[idx];

    // Refrescar indicadores de progreso
    document.getElementById("quiz-run-progress").innerText = `Pregunta ${idx + 1} de ${total}`;
    document.getElementById("quiz-run-pbar").style.width = ((idx + 1) / total * 100) + "%";

    // Renderizar enunciado base
    document.getElementById("quiz-question-text").innerText = q.statement;

    // Generar bloque de alternativas
    const optionsContainer = document.getElementById("quiz-options-container");
    optionsContainer.innerHTML = "";

    const letters = ["A", "B", "C", "D"];
    const previousAnswer = activeQuizState.answers[idx];

    q.options.forEach((opt, oIdx) => {
        const optionCard = document.createElement("div");
        optionCard.className = "quiz-option-card";

        // Restaurar estado visual de opciones respondidas
        if (previousAnswer !== null) {
            optionCard.classList.add("disabled");
            if (oIdx === q.correct_option) {
                optionCard.classList.add("correct");
            } else if (oIdx === previousAnswer) {
                optionCard.classList.add("incorrect");
            }
        } else if (activeQuizState.selectedOption === oIdx) {
            optionCard.classList.add("selected");
        }

        optionCard.innerHTML = `
            <span class="option-badge-letter">${letters[oIdx]}</span>
            <span class="option-text">${opt}</span>
        `;

        optionCard.onclick = () => {
            if (activeQuizState.answers[idx] !== null) return; // Prevenir selección múltiple en pregunta validada

            document.querySelectorAll(".quiz-option-card").forEach(c => c.classList.remove("selected"));
            optionCard.classList.add("selected");
            activeQuizState.selectedOption = oIdx;

            document.getElementById("quiz-btn-submit").disabled = false;
        };

        optionsContainer.appendChild(optionCard);
    });

    // Administrar visibilidad de controles de navegación
    const submitBtn = document.getElementById("quiz-btn-submit");
    const nextBtn = document.getElementById("quiz-btn-next");
    const feedbackPanel = document.getElementById("quiz-feedback-panel");

    if (previousAnswer !== null) {
        // Configurar vista para pregunta evaluada
        submitBtn.style.display = "none";
        nextBtn.style.display = "block";
        nextBtn.innerText = (idx === total - 1) ? "Finalizar Evaluación" : "Siguiente Pregunta";

        feedbackPanel.style.display = "block";
        feedbackPanel.className = `quiz-feedback-box ${previousAnswer === q.correct_option ? 'correct' : 'incorrect'}`;
        feedbackPanel.querySelector(".feedback-indicator-icon").innerText = previousAnswer === q.correct_option ? "✅" : "❌";
        feedbackPanel.querySelector(".feedback-indicator-title").innerText = previousAnswer === q.correct_option ? "Verificación Exitosa" : "Respuesta Incorrecta";
        document.getElementById("quiz-explanation-text").innerText = q.explanation || "No se dispone de retroalimentación adicional.";
    } else {
        // Configurar vista para pregunta pendiente
        submitBtn.style.display = "block";
        submitBtn.disabled = activeQuizState.selectedOption === null;
        nextBtn.style.display = "none";
        feedbackPanel.style.display = "none";
    }
}

/** Registrar y evaluar respuesta del usuario */
function submitAnswer() {
    const idx = activeQuizState.currentIdx;
    const q = activeQuizState.problems[idx];
    const sel = activeQuizState.selectedOption;

    if (sel === null) return;
    activeQuizState.answers[idx] = sel;
    activeQuizState.selectedOption = null;

    const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
    if (user && window.UserManager) {
        UserManager.updateStreak(user.id).catch(err => console.error("Error updating streak:", err));
    }
    renderCurrentQuestion();
}

/** Transicionar a la siguiente pregunta o concluir evaluación */
function nextQuestion() {
    const idx = activeQuizState.currentIdx;
    const total = activeQuizState.problems.length;

    if (idx < total - 1) {
        activeQuizState.currentIdx++;
        activeQuizState.selectedOption = null;
        renderCurrentQuestion();
    } else {
        finishQuiz();
    }
}

/** Concluir evaluación, calcular rendimiento y otorgar recompensas */
function finishQuiz() {
    clearInterval(activeQuizState.timerInterval);
    showPreloader("Compilando resultados y procesando métricas...");

    const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
    if (!user) return;

    let correctCount = 0;
    activeQuizState.problems.forEach((q, idx) => {
        if (activeQuizState.answers[idx] === q.correct_option) {
            correctCount++;
        }
    });

    const total = activeQuizState.problems.length;
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const elapsedSecs = Math.floor((Date.now() - activeQuizState.startTime) / 1000);
    const mins = Math.floor(elapsedSecs / 60).toString().padStart(2, "0");
    const secs = (elapsedSecs % 60).toString().padStart(2, "0");
    const timeStr = `${mins}:${secs}`;

    // Calcular distribución de experiencia adquirida
    let xpEarned = correctCount * 20;
    if (pct === 100) xpEarned += activeQuizState.xpReward; // Asignar bonificación por puntuación perfecta
    else if (pct >= 60) xpEarned += Math.round(activeQuizState.xpReward * 0.6); // Asignar bonificación parcial por aprobación

    // Registrar avance en el mapa de aprendizaje
    if (!activeQuizState.isGeneral && activeQuizState.topic_id) {
        // Registrar superación de tema sujeta a umbral de aprobación
        if (pct >= 60) {
            UserManager.completeTopicProgress(
                user.id,
                activeQuizState.topic_id,
                activeQuizState.course_id,
                xpEarned
            );
        } else {
            // Asignar experiencia residual sin registrar superación
            UserManager.addXp(user.id, xpEarned);
        }
    } else {
        // Asignar experiencia obtenida en evaluación general
        UserManager.addXp(user.id, xpEarned);
    }

    // Guardar estadísticas en el backend (Supabase) agrupadas por tópico real
    if (window.UserManager) {
        const statsByTopic = {};
        
        activeQuizState.problems.forEach((q, idx) => {
            const tId = q.topic_id;
            if (!tId) return; // Prevenir guardado si no hay topic_id
            
            if (!statsByTopic[tId]) {
                statsByTopic[tId] = { correct: 0, incorrect: 0 };
            }
            if (activeQuizState.answers[idx] === q.correct_option) {
                statsByTopic[tId].correct++;
            } else {
                statsByTopic[tId].incorrect++;
            }
        });

        for (const [tId, counts] of Object.entries(statsByTopic)) {
            UserManager.saveUserTopicStats(user.id, tId, counts.correct, counts.incorrect);
        }
    }

    // Guardar estadísticas de rendimiento en localStorage (historial de simulacros fallback)
    try {
        const perfKey = `eduquest_performance_${user.id}`;
        const perfData = JSON.parse(localStorage.getItem(perfKey) || '{"history":[]}');
        perfData.history.push({
            course_id: activeQuizState.course_id || 'general',
            isGeneral: activeQuizState.isGeneral,
            correct: correctCount,
            incorrect: total - correctCount,
            total: total,
            timestamp: Date.now()
        });
        localStorage.setItem(perfKey, JSON.stringify(perfData));
    } catch (e) {
        console.error("Error guardando estadísticas de rendimiento:", e);
    }

    // Disparar ganchos de gamificación para retos diarios
    if (window.GamificationManager) {
        // Acumular experiencia obtenida
        GamificationManager.updateDailyChallengeProgress("total_xp", xpEarned);
        // Acumular métrica de respuestas correctas
        GamificationManager.updateDailyChallengeProgress("quiz_questions", correctCount);
        // Acumular métrica de evaluaciones completadas
        GamificationManager.updateDailyChallengeProgress("complete_quiz", 1);

        // Evaluar criterios para otorgamiento de insignias
        if (pct === 100) {
            GamificationManager.checkAndAwardBadge(user.id, "badge_perfect_score");
        }
    }

    // Renderizar interfaz de resultados consolidados
    hidePreloader();
    document.querySelectorAll(".quiz-view-section").forEach(v => v.classList.remove("active"));
    document.getElementById("quiz-results-view").classList.add("active");

    // Poblar métricas de rendimiento
    document.getElementById("results-score").innerText = `${correctCount} / ${total}`;
    document.getElementById("results-accuracy").innerText = `${pct}%`;
    document.getElementById("results-xp-gained").innerText = `+${xpEarned} XP`;
    document.getElementById("results-time").innerText = timeStr;

    // Asignar titular de evaluación según rendimiento
    const headlineEl = document.getElementById("results-headline");
    const subEl = document.getElementById("results-subheadline");

    if (pct === 100) {
        headlineEl.innerText = "Desempeño Óptimo Registrado";
        subEl.innerText = "La totalidad de las respuestas han sido validadas como correctas.";
    } else if (pct >= 60) {
        headlineEl.innerText = "Evaluación Superada";
        subEl.innerText = "El rendimiento supera el umbral de aprobación requerido.";
    } else {
        headlineEl.innerText = "Rendimiento Deficiente";
        subEl.innerText = "Se recomienda revisar el material didáctico antes de un nuevo intento.";
    }
}

/** Interrumpir evaluación en curso previa confirmación */
function confirmExitQuiz() {
    if (confirm("Advertencia: Al interrumpir la evaluación se descartará el progreso actual. ¿Confirmar salida?")) {
        clearInterval(activeQuizState.timerInterval);
        exitToSelection();
    }
}

function exitToSelection() {
    document.querySelectorAll(".quiz-view-section").forEach(v => v.classList.remove("active"));
    document.getElementById("quizzes-selection-view").classList.add("active");

    // Restablecer parámetros de URL
    window.history.replaceState({}, document.title, window.location.pathname);

    // Actualizar indicadores visuales de progreso
    loadQuizzesSelection();
}

/** Utilidades de carga visual */
function showPreloader(msg) {
    const loader = document.getElementById("app-preloader");
    if (loader) {
        loader.style.opacity = "1";
        loader.style.display = "flex";
        loader.querySelector("p").innerText = msg;
    }
}

function hidePreloader() {
    const loader = document.getElementById("app-preloader");
    if (loader) {
        loader.style.opacity = "0";
        setTimeout(() => loader.style.display = "none", 400);
    }
}

// Exponer métodos de interfaz al contexto global
window.filterCourses = filterCourses;
window.startSpecificQuiz = startSpecificQuiz;
window.startGeneralMockExam = startGeneralMockExam;
window.submitAnswer = submitAnswer;
window.prevQuestion = () => { };
window.nextQuestion = nextQuestion;
window.confirmExitQuiz = confirmExitQuiz;
window.exitToSelection = exitToSelection;
