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

    // Si existe una ruta IA personalizada, mostrar SOLO esa ruta
    if (session) {
        const aiRoadmapJson = localStorage.getItem(`eduquest_roadmap_${session.userId}`);
        if (aiRoadmapJson) {
            try {
                const aiRoutes = JSON.parse(aiRoadmapJson);
                if (aiRoutes.length > 0) {
                    return aiRoutes;
                }
            } catch(e) {
                console.error("Error parsing AI roadmap", e);
            }
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
        const completed = 0;
        const total = courseTopics.length;

        return {
            id: course.id,
            name: course.name,
            icon: course.icon,
            color: course.color,
            meta: `Meta: ${userTarget}`,
            progressPct: 0,
            completedLevels: completed,
            totalLevels: total,
            xpEarned: 0,
            levels: courseTopics.map((t, idx) => ({
                id: t.id,
                title: t.name,
                status: idx === 0 ? 'unlocked' : 'locked'
            }))
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