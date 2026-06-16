// Datos Generales del Estudiante (Gamificación Básica para evitar carga cognitiva)
const studentStats = {
    name: "Chris Carrasco",
    avatar: "🚀",
    target: "Meta: UNI",
    career: "Ingeniería de Sistemas",
    totalXp: "1,150 XP",
    streakDays: "3 Días",
    rankingPos: "#3 en Aula"
};

// Banco de datos local de Cursos con Trazabilidad al temario de Admisión
const globalRutasData = [
    {
        id: "ALGEBRA",
        name: "Álgebra Preuniversitaria",
        icon: "📐",
        color: "#1D9E75",
        meta: "Meta: UNI",
        progressPct: 40,
        completedLevels: 2,
        totalLevels: 5,
        xpEarned: 450,
        levels: [
            { id: 1, title: "Leyes de Exponentes y Radicación", status: "completed" },
            { id: 2, title: "Polinomios y Grados Especiales", status: "completed" },
            { id: 3, title: "Productos Notables Avanzados", status: "unlocked" },
            { id: 4, title: "División Polinomial y Ruffini", status: "locked" },
            { id: 5, title: "Teorema del Resto y Factorización", status: "locked" }
        ]
    },
    {
        id: "GEOMETRIA",
        name: "Geometría del Espacio",
        icon: "🔮",
        color: "#7F77DD",
        meta: "Meta: UNI",
        progressPct: 0,
        completedLevels: 0,
        totalLevels: 3,
        xpEarned: 0,
        levels: [
            { id: 6, title: "Segmentos y Ángulos Pro", status: "unlocked" },
            { id: 7, title: "Triángulos: Congruencia y Semejanza", status: "locked" },
            { id: 8, title: "Polígonos y Cuadriláteros", status: "locked" }
        ]
    },
    {
        id: "FISICA",
        name: "Física y Cinemática",
        icon: "⚡",
        color: "#EF9F27",
        meta: "Meta: San Marcos",
        progressPct: 100,
        completedLevels: 3,
        totalLevels: 3,
        xpEarned: 700,
        levels: [
            { id: 9, title: "Análisis Dimensional y Vectores", status: "completed" },
            { id: 10, title: "Movimiento Rectilíneo Uniforme (MRU)", status: "completed" },
            { id: 11, title: "Movimiento Parabólico de Caída Libre", status: "completed" }
        ]
    },
    {
        id: "LECTORA",
        name: "Comprensión Lectora",
        icon: "📚",
        color: "#E24B4A",
        meta: "Meta: San Marcos",
        progressPct: 66,
        completedLevels: 2,
        totalLevels: 3,
        xpEarned: 500,
        levels: [
            { id: 12, title: "Jerarquía Textual y Tema Central", status: "completed" },
            { id: 13, title: "Sentido Contextual y Sinonimia", status: "completed" },
            { id: 14, title: "Inferencia y Extrapolación Fija", status: "unlocked" }
        ]
    }
];

document.addEventListener("DOMContentLoaded", () => {
    // 1. Renderizar el Banner del Perfil Express
    buildStudentProfileBanner();

    // 2. Renderizar la cuadrícula de Cursos (Hub Principal)
    buildCourseSelectionGrid();

    // 3. Control nuclear del preloader
    setTimeout(() => {
        const preloader = document.getElementById("app-preloader");
        if (preloader) preloader.classList.add("fade-out-loader");
    }, 350);
});

// NUEVO: Generar dinámicamente el perfil del alumno en la parte superior
function buildStudentProfileBanner() {
    const bannerContainer = document.getElementById("student-profile-summary");
    if (!bannerContainer) return;

    bannerContainer.innerHTML = `
        <div class="profile-express-left">
            <div class="profile-express-avatar">${studentStats.avatar}</div>
            <div class="profile-express-welcome">
                <h3>¡Hola, ${studentStats.name}!</h3>
                <p>${studentStats.target} • ${studentStats.career}</p>
            </div>
        </div>
        <div class="profile-express-stats">
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--green);">${studentStats.totalXp}</span>
                <span class="express-stat-label">Progreso Total</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--amber);">🔥 ${studentStats.streakDays}</span>
                <span class="express-stat-label">Racha Activa</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--indigo);">${studentStats.rankingPos}</span>
                <span class="express-stat-label">Competencia</span>
            </div>
        </div>
    `;
}

// Renderizar dinámicamente las tarjetas de Cursos
function buildCourseSelectionGrid() {
    const grid = document.getElementById("courses-grid");
    if (!grid) return;
    grid.innerHTML = "";

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

// Función SPA para abrir el mapa Candy Crush de un curso específico
function openSpecificCourseMap(courseId) {
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
                <span>${lvl.id}</span>
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