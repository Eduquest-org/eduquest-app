// assets/js/student/quizzes.js
// CONTROLADOR LOGICO DE PRÁCTICAS Y SIMULACROS INTERACTIVOS

let activeQuizState = {
    problems: [],
    currentIdx: 0,
    answers: [], // Guarda la opción elegida en cada índice
    startTime: null,
    timerInterval: null,
    topicId: null,
    courseId: null,
    title: "",
    xpReward: 150,
    isGeneral: false
};

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Cargar catálogo de quizzes
    await loadQuizzesSelection();

    // 2. Revisar si viene de la ruta con parámetros de inicio inmediato
    const params = new URLSearchParams(window.location.search);
    const topicParam = params.get("level");
    const typeParam = params.get("type"); // quiz, examen, desafio_final

    if (topicParam) {
        startQuizFromParam(topicParam, typeParam);
    } else {
        // Apagar loader si no hay auto-inicio
        const loader = document.getElementById("app-preloader");
        if (loader) {
            loader.style.opacity = "0";
            setTimeout(() => loader.remove(), 400);
        }
    }
});

// Carga y renderiza el catálogo de cursos y sus temas para practicar
async function loadQuizzesSelection() {
    const grid = document.getElementById("courses-quizzes-grid");
    if (!grid) return;

    try {
        const [coursesRes, topicsRes] = await Promise.all([
            fetch("../../mock/courses.json"),
            fetch("../../mock/topics.json")
        ]);

        const courses = await coursesRes.json();
        const topics = await topicsRes.json();

        // Obtener temas completados por el usuario
        const session = Storage.getSession();
        let completedTopics = [];
        if (session) {
            const user = UserManager.getUserById(session.userId);
            if (user && user.learningProgress) {
                completedTopics = user.learningProgress.completedTopics || [];
            }
        }

        grid.innerHTML = "";

        courses.forEach(course => {
            const courseTopics = topics.filter(t => t.courseId === course.id);
            if (courseTopics.length === 0) return; // Omitir cursos sin temas

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

// Filtro de categorías del catálogo
function filterCourses(category, buttonEl) {
    // Alternar chip activo
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

// Auto-inicio de un quiz según parámetros de URL (RAG del roadmap)
async function startQuizFromParam(topicId, type) {
    try {
        const topicsRes = await fetch("../../mock/topics.json");
        const topics = await topicsRes.json();
        
        const topic = topics.find(t => t.id === topicId);
        if (topic) {
            startSpecificQuiz(topic.id, topic.name, topic.courseId, type === 'examen' ? 200 : 100);
        } else {
            // Fallback si no encuentra id del tema
            alert("No se encontró el tema solicitado. Iniciando examen general.");
            startGeneralMockExam();
        }
    } catch (e) {
        console.error("Error auto-iniciando quiz:", e);
    }
}

// Iniciar un simulacro específico de un tema
async function startSpecificQuiz(topicId, topicName, courseId, xpReward) {
    showPreloader("Generando cuestionario enfocado...");

    try {
        const problemsRes = await fetch("../../mock/problems.json");
        const allProblems = await problemsRes.json();

        // Filtrar problemas de este tema
        let filtered = allProblems.filter(p => p.topicId === topicId);

        if (filtered.length === 0) {
            // Si no hay problemas con ese topicId exacto, buscar por curso similar en el ID
            const coursePrefix = topicId.split("_")[1]; // ej: topic_leyes_exp -> leyes
            filtered = allProblems.filter(p => p.id && p.id.includes(`_${coursePrefix}_`));
        }

        if (filtered.length === 0) {
            // Fallback definitivo
            filtered = allProblems.slice(0, 5);
        }

        // Seleccionar máximo 5 preguntas al azar
        const shuffle = arr => arr.sort(() => 0.5 - Math.random());
        const selectedProblems = shuffle([...filtered]).slice(0, 5);

        activeQuizState = {
            problems: selectedProblems,
            currentIdx: 0,
            answers: new Array(selectedProblems.length).fill(null),
            startTime: Date.now(),
            topicId: topicId,
            courseId: courseId,
            title: `Práctica: ${topicName}`,
            xpReward: xpReward || 100,
            isGeneral: false
        };

        hidePreloader();
        launchQuizRunner();

    } catch (error) {
        console.error("Error iniciando simulacro de tema:", error);
        hidePreloader();
        alert("Ocurrió un error cargando las preguntas.");
    }
}

// Iniciar Simulacro General de Admisión (10 preguntas mezcladas)
async function startGeneralMockExam() {
    showPreloader("Mezclando preguntas de Admisión...");

    try {
        const problemsRes = await fetch("../../mock/problems.json");
        const allProblems = await problemsRes.json();

        // Filtrar de RM y RV
        const rm = allProblems.filter(p => p.id && p.id.includes("prob_rm_"));
        const rv = allProblems.filter(p => p.id && (p.id.includes("prob_rv_") || p.id.includes("prob_lect_")));

        const shuffle = arr => arr.sort(() => 0.5 - Math.random());
        const selected = [...shuffle(rm).slice(0, 5), ...shuffle(rv).slice(0, 5)];

        activeQuizState = {
            problems: selected,
            currentIdx: 0,
            answers: new Array(selected.length).fill(null),
            startTime: Date.now(),
            topicId: null,
            courseId: null,
            title: "Simulacro General de Admisión",
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

// Cambiar vistas a la pantalla del reproductor de exámenes
function launchQuizRunner() {
    document.querySelectorAll(".quiz-view-section").forEach(v => v.classList.remove("active"));
    document.getElementById("quiz-runner-view").classList.add("active");

    // Reiniciar UI
    document.getElementById("quiz-run-title").innerText = activeQuizState.title;
    
    // Iniciar timer
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

// Renderizar la pregunta actual
function renderCurrentQuestion() {
    const idx = activeQuizState.currentIdx;
    const total = activeQuizState.problems.length;
    const q = activeQuizState.problems[idx];

    // Actualizar progreso
    document.getElementById("quiz-run-progress").innerText = `Pregunta ${idx + 1} de ${total}`;
    document.getElementById("quiz-run-pbar").style.width = ((idx + 1) / total * 100) + "%";

    // Enunciado
    document.getElementById("quiz-question-text").innerText = q.statement;

    // Opciones
    const optionsContainer = document.getElementById("quiz-options-container");
    optionsContainer.innerHTML = "";
    
    const letters = ["A", "B", "C", "D"];
    const previousAnswer = activeQuizState.answers[idx];

    q.options.forEach((opt, oIdx) => {
        const optionCard = document.createElement("div");
        optionCard.className = "quiz-option-card";
        
        // Restaurar estado si ya se respondió
        if (previousAnswer !== null) {
            optionCard.classList.add("disabled");
            if (oIdx === q.correctOption) {
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
            if (activeQuizState.answers[idx] !== null) return; // Ya se validó
            
            document.querySelectorAll(".quiz-option-card").forEach(c => c.classList.remove("selected"));
            optionCard.classList.add("selected");
            activeQuizState.selectedOption = oIdx;
            
            document.getElementById("quiz-btn-submit").disabled = false;
        };

        optionsContainer.appendChild(optionCard);
    });

    // Controlar botones de pie
    const submitBtn = document.getElementById("quiz-btn-submit");
    const nextBtn = document.getElementById("quiz-btn-next");
    const feedbackPanel = document.getElementById("quiz-feedback-panel");

    if (previousAnswer !== null) {
        // Pregunta ya calificada
        submitBtn.style.display = "none";
        nextBtn.style.display = "block";
        nextBtn.innerText = (idx === total - 1) ? "Finalizar Simulacro" : "Siguiente Pregunta";
        
        feedbackPanel.style.display = "block";
        feedbackPanel.className = `quiz-feedback-box ${previousAnswer === q.correctOption ? 'correct' : 'incorrect'}`;
        feedbackPanel.querySelector(".feedback-indicator-icon").innerText = previousAnswer === q.correctOption ? "✅" : "❌";
        feedbackPanel.querySelector(".feedback-indicator-title").innerText = previousAnswer === q.correctOption ? "¡Respuesta Correcta!" : "Respuesta Incorrecta";
        document.getElementById("quiz-explanation-text").innerText = q.explanation || "No hay explicación disponible.";
    } else {
        // Pregunta por responder
        submitBtn.style.display = "block";
        submitBtn.disabled = activeQuizState.selectedOption === null;
        nextBtn.style.display = "none";
        feedbackPanel.style.display = "none";
    }
}

// Validar respuesta del estudiante (Calificación interactiva)
function submitAnswer() {
    const idx = activeQuizState.currentIdx;
    const q = activeQuizState.problems[idx];
    const sel = activeQuizState.selectedOption;

    if (sel === null) return;

    // Guardar respuesta calificada
    activeQuizState.answers[idx] = sel;
    activeQuizState.selectedOption = null;

    // Renderizar para mostrar la corrección visual inmediata
    renderCurrentQuestion();
}

// Pasar a la siguiente pregunta o finalizar
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

// Finaliza el simulacro y guarda estadísticas y XP
function finishQuiz() {
    clearInterval(activeQuizState.timerInterval);
    showPreloader("Compilando tus resultados y sumando XP...");

    const session = Storage.getSession();
    if (!session) return;

    // Calcular estadísticas
    let correctCount = 0;
    activeQuizState.problems.forEach((q, idx) => {
        if (activeQuizState.answers[idx] === q.correctOption) {
            correctCount++;
        }
    });

    const total = activeQuizState.problems.length;
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const elapsedSecs = Math.floor((Date.now() - activeQuizState.startTime) / 1000);
    const mins = Math.floor(elapsedSecs / 60).toString().padStart(2, "0");
    const secs = (elapsedSecs % 60).toString().padStart(2, "0");
    const timeStr = `${mins}:${secs}`;

    // Calcular XP ganado (ej: 30 XP por correcta, más bono por porcentaje)
    let xpEarned = correctCount * 20; 
    if (pct === 100) xpEarned += activeQuizState.xpReward; // Bono completo si es perfecto
    else if (pct >= 60) xpEarned += Math.round(activeQuizState.xpReward * 0.6); // Bono parcial

    // Guardar progreso en el Roadmap del usuario
    if (!activeQuizState.isGeneral && activeQuizState.topicId) {
        // Solo marcar tema superado si aprobó con >= 60%
        if (pct >= 60) {
            UserManager.completeTopicProgress(
                session.userId, 
                activeQuizState.topicId, 
                activeQuizState.courseId, 
                xpEarned
            );
        } else {
            // Si desaprobó, igual darle su XP menor, pero sin marcar tema
            UserManager.addXp(session.userId, xpEarned);
        }
    } else {
        // Simulacro general, solo sumar XP
        UserManager.addXp(session.userId, xpEarned);
    }

    // AUMENTAR RETO DIARIO (Hooks)
    if (window.GamificationManager) {
        // Sumar total_xp
        GamificationManager.updateDailyChallengeProgress("total_xp", xpEarned);
        // Sumar quiz_questions (correctas)
        GamificationManager.updateDailyChallengeProgress("quiz_questions", correctCount);
        // Sumar complete_quiz
        GamificationManager.updateDailyChallengeProgress("complete_quiz", 1);

        // EVALUAR INSIGNIA: Perfección absoluta (100% de aciertos)
        if (pct === 100) {
            GamificationManager.checkAndAwardBadge(session.userId, "badge_perfect_score");
        }
    }

    // RENDERIZAR VISTA DE RESULTADOS
    hidePreloader();
    document.querySelectorAll(".quiz-view-section").forEach(v => v.classList.remove("active"));
    document.getElementById("quiz-results-view").classList.add("active");

    // Rellenar valores finales
    document.getElementById("results-score").innerText = `${correctCount} / ${total}`;
    document.getElementById("results-accuracy").innerText = `${pct}%`;
    document.getElementById("results-xp-gained").innerText = `+${xpEarned} XP`;
    document.getElementById("results-time").innerText = timeStr;

    // Encabezado según nota
    const headlineEl = document.getElementById("results-headline");
    const subEl = document.getElementById("results-subheadline");
    
    if (pct === 100) {
        headlineEl.innerText = "¡Perfección Absoluta! 💯🏆";
        subEl.innerText = "Has respondido todas las preguntas de manera correcta. ¡Qué nivel!";
    } else if (pct >= 60) {
        headlineEl.innerText = "¡Felicidades, aprobado! 🎉";
        subEl.innerText = "Superaste la práctica exitosamente y asimilaste nuevos conceptos.";
    } else {
        headlineEl.innerText = "¡Buen intento! 💪";
        subEl.innerText = "Te sugerimos repasar el material educativo y volver a intentarlo.";
    }
}

// Salir del cuestionario en ejecución (Confirmación de seguridad)
function confirmExitQuiz() {
    if (confirm("⚠️ ¿Estás seguro que deseas salir del simulacro? Perderás todo tu progreso actual de este examen.")) {
        clearInterval(activeQuizState.timerInterval);
        exitToSelection();
    }
}

function exitToSelection() {
    document.querySelectorAll(".quiz-view-section").forEach(v => v.classList.remove("active"));
    document.getElementById("quizzes-selection-view").classList.add("active");
    
    // Limpiar url
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Recargar checkmarks
    loadQuizzesSelection();
}

/* CARGADORES DE PANTALLA */
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

// Exportar funciones globales
window.filterCourses = filterCourses;
window.startSpecificQuiz = startSpecificQuiz;
window.startGeneralMockExam = startGeneralMockExam;
window.submitAnswer = submitAnswer;
window.prevQuestion = () => {}; // Dejado vacío
window.nextQuestion = nextQuestion;
window.confirmExitQuiz = confirmExitQuiz;
window.exitToSelection = exitToSelection;
