// assets/js/student/roadmap.js

document.addEventListener("DOMContentLoaded", () => {
    buildStudentProfileBanner();
    buildCourseSelectionGrid();

    setTimeout(() => {
        const preloader = document.getElementById("app-preloader");
        if (preloader) preloader.classList.add("fade-out-loader");
    }, 350);
});

function buildStudentProfileBanner() {
    const bannerContainer = document.getElementById("student-profile-summary");
    if (!bannerContainer) return;

    bannerContainer.innerHTML = `
        <div class="profile-express-left">
            <div class="profile-express-avatar" data-user-avatar></div>
            <div class="profile-express-welcome">
                <h3>¡Hola, <span data-user-firstname></span>!</h3>
                <p>Meta: <span data-user-target></span> • <span data-user-career></span></p>
            </div>
        </div>
        <div class="profile-express-stats">
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--green);" data-user-xp></span>
                <span class="express-stat-label">Progreso Total</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--amber);">🔥 <span data-user-streak></span></span>
                <span class="express-stat-label">Racha Activa</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--indigo);" data-user-ranking></span>
                <span class="express-stat-label">Competencia</span>
            </div>
        </div>
    `;

    if (window.UserBindingManager) UserBindingManager.bindAll();
}

async function fetchDynamicRoadmap() {
    const session = Storage.getSession();

    // Obtener temas completados del usuario para calcular progreso
    let completedTopics = [];
    if (session && window.UserManager) {
        const user = UserManager.getUserById(session.userId);
        if (user && user.learningProgress) {
            completedTopics = user.learningProgress.completedTopics || [];
        }
    }

    // Si existe una ruta IA personalizada, mostrar SOLO esa ruta
    if (session && window.UserManager) {
        const aiRoutes = UserManager.getCustomRoadmap(session.userId);
        if (aiRoutes.length > 0) {
            // Recalcular progreso basado en completedTopics
            return aiRoutes.map(route => {
                const completedLevels = route.levels.filter(lvl => completedTopics.includes(lvl.id)).length;
                const totalLevels = route.levels.length;
                const progressPct = totalLevels > 0 ? Math.round((completedLevels / totalLevels) * 100) : 0;

                return {
                    ...route,
                    completedLevels,
                    progressPct,
                    xpEarned: completedLevels * 50,
                    levels: route.levels.map((lvl, idx) => {
                        if (completedTopics.includes(lvl.id)) {
                            return { ...lvl, status: 'completed' };
                        }
                        // El primer nivel no-completado se desbloquea
                        const allPreviousCompleted = route.levels.slice(0, idx).every(
                            prev => completedTopics.includes(prev.id)
                        );
                        if (idx === 0 || allPreviousCompleted) {
                            return { ...lvl, status: 'unlocked' };
                        }
                        return { ...lvl, status: 'locked' };
                    })
                };
            });
        }
    }

    // Fallback: si no hay ruta IA (usuario sin diagnóstico), mostrar catálogo genérico
    const [coursesRes, topicsRes] = await Promise.all([
        fetch("../../mock/courses.json"),
        fetch("../../mock/topics.json")
    ]);
    const courses = await coursesRes.json();
    const topics = await topicsRes.json();

    let userTarget = "UNI";
    if (window.CurrentUserService) {
        userTarget = CurrentUserService.getStat('target') || "UNI";
    }

    return courses.map(course => {
        const courseTopics = topics.filter(t => t.courseId === course.id);
        const completedLevels = courseTopics.filter(t => completedTopics.includes(t.id)).length;
        const total = courseTopics.length;
        const progressPct = total > 0 ? Math.round((completedLevels / total) * 100) : 0;

        return {
            id: course.id,
            name: course.name,
            icon: course.icon,
            color: course.color,
            meta: `Meta: ${userTarget}`,
            progressPct: progressPct,
            completedLevels: completedLevels,
            totalLevels: total,
            xpEarned: completedLevels * 50,
            levels: courseTopics.map((t, idx) => {
                if (completedTopics.includes(t.id)) {
                    return { id: t.id, title: t.name, status: 'completed' };
                }
                const allPreviousCompleted = courseTopics.slice(0, idx).every(
                    prev => completedTopics.includes(prev.id)
                );
                if (idx === 0 || allPreviousCompleted) {
                    return { id: t.id, title: t.name, status: 'unlocked' };
                }
                return { id: t.id, title: t.name, status: 'locked' };
            })
        };
    });
}

async function buildCourseSelectionGrid() {
    const grid = document.getElementById("courses-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const globalRutasData = await fetchDynamicRoadmap();
    window._cachedRutasData = globalRutasData; 

    globalRutasData.forEach(curso => {
        const card = document.createElement("div");
        card.className = "course-card";
        
        card.innerHTML = `
            <div class="card-top">
                <div class="course-icon-box" style="background: ${curso.color}">${curso.icon}</div>
                <div class="course-meta-title">
                    <h3>${curso.name}</h3>
                    <span>${curso.meta}</span>
                </div>
            </div>
            
            <div class="card-stats">
                <div>Progreso: <span class="stat-highlight">${curso.completedLevels}/${curso.totalLevels} Nivel</span></div>
                <div><span class="stat-highlight" style="color:${curso.color}">+${curso.xpEarned} XP</span></div>
            </div>

            <div class="progress-wrapper">
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${curso.progressPct}%; background: ${curso.color}"></div>
                </div>
                <span class="progress-text-pct" style="color: ${curso.color}">${curso.progressPct}% Completado</span>
            </div>

            <button class="btn-enter-route" onclick="openSpecificCourseMap('${curso.id}')">Explorar Mapa</button>
        `;
        grid.appendChild(card);
    });
}

function openSpecificCourseMap(courseId) {
    const globalRutasData = window._cachedRutasData || [];
    const cursoSeleccionado = globalRutasData.find(c => c.id === courseId);
    if (!cursoSeleccionado) return;

    document.getElementById("current-map-title").innerText = `Mundo: ${cursoSeleccionado.name}`;
    
    const mapContainer = document.getElementById("dynamic-map-container");
    mapContainer.innerHTML = "";

    const pattern = ["node-left", "node-center", "node-right", "node-center"];

    cursoSeleccionado.levels.forEach((lvl, idx) => {
        const node = document.createElement("div");
        const position = pattern[idx % pattern.length];
        node.className = `roadmap-node ${lvl.status} ${position}`;

        let stateLabel = "Bloqueado";
        if (lvl.status === "completed") stateLabel = "¡Superado! ✨";
        if (lvl.status === "unlocked") stateLabel = "¡Disponible! 🔥";

        node.innerHTML = `
            <div class="node-circle" onclick="launchQuizChallenge('${lvl.id}', '${lvl.status}')">
                <span>${idx + 1}</span>
                <div class="node-tooltip">
                    <strong>${lvl.title}</strong>
                    <span class="tooltip-status">${stateLabel}</span>
                </div>
            </div>
        `;
        mapContainer.appendChild(node);
    });

    document.getElementById("course-selection-view").classList.remove("active");
    document.getElementById("course-map-view").classList.add("add", "active");
}

function switchBackToSelection() {
    document.getElementById("course-map-view").classList.remove("active");
    document.getElementById("course-selection-view").classList.add("active");
}

function launchQuizChallenge(id, status) {
    if (status === "locked") {
        alert("🔒 Nivel Bloqueado: Necesitas completar los simulacros previos de este curso para abrir el tema.");
        return;
    }
    window.location.href = `quizzes.html?level=${id}`;
}