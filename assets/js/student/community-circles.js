// 1. Estadísticas Gamificadas Básicas para el Banner Superior de Comunidad
const communityStudentData = {
    name: "Chris Carrasco",
    avatar: "👥",
    target: "Meta: UNI",
    career: "Ingeniería de Sistemas",
    joinedCircles: "1 Sala",
    totalContributions: "14 Aportes",
    streakDays: "3 Días"
};

// 2. Base de datos simulada del tablón de salas preuniversitarias (EP-04)
const mockCirclesData = [
    {
        id: "C_01",
        courseCode: "ALGEBRA",
        courseName: "Álgebra",
        title: "Vectores y Matrices UNI",
        description: "Salón de práctica intensiva enfocado en el examen de admisión UNI. Compartimos boletines pasados de Cepre.",
        membersCount: 24,
        colorTheme: "#1D9E75",
        bgTheme: "rgba(29, 158, 117, 0.1)",
        isJoined: false
    },
    {
        id: "C_02",
        courseCode: "LECTORA",
        courseName: "Lectura",
        title: "Comprensión Crítica San Marcos",
        description: "Análisis de textos complejos, inferencias y paradojas de exámenes de admisión reales. ¡Ven a debatir!",
        membersCount: 38,
        colorTheme: "#E24B4A",
        bgTheme: "rgba(226, 75, 74, 0.1)",
        isJoined: true // Chris ya arranca dentro de este círculo
    },
    {
        id: "C_03",
        courseCode: "FISICA",
        courseName: "Física",
        title: "Cinemática y MRUV Express",
        description: "Grupo de amanecida para resolver problemas de caída libre y movimiento parabólico nivel intermedio.",
        membersCount: 15,
        colorTheme: "#EF9F27",
        bgTheme: "rgba(239, 159, 39, 0.1)",
        isJoined: false
    },
    {
        id: "C_04",
        courseCode: "GEOMETRIA",
        courseName: "Geometría",
        title: "Geometría del Espacio desde Cero",
        description: "Para los que volamos en el espacio tridimensional. Hacemos videollamadas rápidas para trazar juntos.",
        membersCount: 19,
        colorTheme: "#7F77DD",
        bgTheme: "rgba(127, 119, 221, 0.1)",
        isJoined: false
    }
];

let activeCourseFilter = "ALL";

document.addEventListener("DOMContentLoaded", () => {
    // Inicializar inyecciones dinámicas
    buildCommunityProfileBanner();
    renderCirclesStream();

    // Apagado automático del preloader modular
    setTimeout(() => {
        const preloader = document.getElementById("app-preloader");
        if (preloader) preloader.classList.add("fade-out-loader");
    }, 350);
});

// Inyectar el Banner Express Superior
function buildCommunityProfileBanner() {
    const container = document.getElementById("community-profile-summary");
    if (!container) return;

    container.innerHTML = `
        <div class="profile-express-left">
            <div class="profile-express-avatar">${communityStudentData.avatar}</div>
            <div class="profile-express-welcome">
                <h3>Comunidad de ${communityStudentData.name}</h3>
                <p>${communityStudentData.target} • ${communityStudentData.career}</p>
            </div>
        </div>
        <div class="profile-express-stats">
            <div class="express-stat-item">
                <span id="banner-joined-count" class="express-stat-val" style="color: var(--indigo);">${communityStudentData.joinedCircles}</span>
                <span class="express-stat-label">Mis Círculos</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--green);">${communityStudentData.totalXp || '14'}</span>
                <span class="express-stat-label">Aportes Aula</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--amber);">🔥 ${communityStudentData.streakDays}</span>
                <span class="express-stat-label">Racha Activa</span>
            </div>
        </div>
    `;
}

// Renderizar el tablón de círculos con filtros asíncronos
function renderCirclesStream() {
    const container = document.getElementById("active-circles-container");
    if (!container) return;
    container.innerHTML = "";

    const filteredCircles = mockCirclesData.filter(c => {
        return activeCourseFilter === "ALL" || c.courseCode === activeCourseFilter;
    });

    if (filteredCircles.length === 0) {
        container.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:40px; color:var(--sub); font-size:14px;">🔒 No hay círculos activos para esta materia. ¡Sé el primero en crear uno!</p>`;
        return;
    }

    filteredCircles.forEach(circle => {
        const card = document.createElement("div");
        card.className = `circle-item-card ${circle.isJoined ? 'joined-active' : ''}`;
        
        const buttonText = circle.isJoined ? "🟢 Dentro del Círculo" : "Unirse al Círculo";

        card.innerHTML = `
            <div class="circle-card-header">
                <span class="circle-course-badge" style="background: ${circle.bgTheme}; color: ${circle.colorTheme}">${circle.courseName}</span>
                <span class="circle-meta-members">👥 ${circle.membersCount} alumnos</span>
            </div>
            <h3>${circle.title}</h3>
            <p>${circle.description}</p>
            <button class="btn-join-circle" onclick="toggleCircleMembership('${circle.id}')">${buttonText}</button>
        `;
        container.appendChild(card);
    });
}

// Controlar los clicks de las pestañas superiores (Filtros)
function filterCirclesByCourse(courseCode) {
    activeCourseFilter = courseCode;

    // Cambiar estado visual del botón activo
    const tabs = document.querySelectorAll(".filter-tabs-bar .tab-btn");
    tabs.forEach(tab => {
        if (tab.getAttribute("onclick").includes(`'${courseCode}'`)) {
            tab.classList.add("active");
        } else {
            tab.classList.remove("active");
        }
    });

    renderCirclesStream();
}

// Lógica reactiva de unirse/salir del grupo (Actualiza contadores y el banner express)
function toggleCircleMembership(id) {
    const circle = mockCirclesData.find(c => c.id === id);
    if (!circle) return;

    if (circle.isJoined) {
        circle.isJoined = false;
        circle.membersCount--;
    } else {
        circle.isJoined = true;
        circle.membersCount++;
    }

    // Calcular cuántas salas totales está metido el alumno e incrementar banner superior
    const totalJoined = mockCirclesData.filter(c => c.isJoined).length;
    document.getElementById("banner-joined-count").innerText = `${totalJoined} ${totalJoined === 1 ? 'Sala' : 'Salas'}`;

    // Refrescar el tablón gráfico de inmediato
    renderCirclesStream();
}

function triggerCreateCircleMock() {
    const input = document.getElementById("new-circle-input");
    if (!input || input.value.trim() === "") {
        alert("Por favor escribe un nombre para tu círculo de estudio.");
        return;
    }
    alert(`🚀 ¡Círculo "${input.value}" Maquetado con Éxito! Al conectar tu Base de Datos en la siguiente entrega, esta acción disparará un método POST asíncrono para guardarlo en la nube.`);
    input.value = "";
}