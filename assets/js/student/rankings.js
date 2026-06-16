// ==========================================================================
// assets/js/student/rankings.js
// CONTROLADOR LOGICO DEL LEADERBOARD ACADÉMICO (EDUQUEST)
// ==========================================================================

// 1. Estado del perfil del alumno actual (Estructurado para persistencia posterior)
const activeStudentProfile = {
    id: "U_CHRIS",
    name: "Chris Carrasco",
    avatar: "🏆",
    target: "Meta: UNI",
    career: "Ingeniería de Sistemas",
    totalXp: "1,150 XP",
    streakDays: "3 Días",
    rankingPos: "#3 en Aula"
};

// 2. Base de datos ficticia de la liga, incluyendo a los autores de tu proyecto (Trazabilidad TB)
const classroomLeaderboardData = [
    { id: "U_01", name: "Matias Del Castillo", career: "Ing. de Sistemas (UNI)", streak: "12 días", xp: 1420, isCurrent: false, avatar: "🎓" },
    { id: "U_02", name: "Vanessa Barrientos", career: "Ing. Industrial (UNI)", streak: "8 días", xp: 1280, isCurrent: false, avatar: "🧠" },
    { id: "U_CHRIS", name: "Chris Carrasco", career: "Ing. de Sistemas (UNI)", streak: "3 días", xp: 1150, isCurrent: true, avatar: "✨" }, // Usuario logueado
    { id: "U_03", name: "Mateo Del Carpio", career: "Ciencias de la Computación (UNI)", streak: "5 días", xp: 980, isCurrent: false, avatar: "💻" },
    { id: "U_04", name: "Vivianne Rios", career: "Ing. Civil (PUCP)", streak: "14 días", xp: 910, isCurrent: false, avatar: "🎨" },
    { id: "U_05", name: "Alexander K.", career: "Ing. Mecrónica (UNI)", streak: "0 días", xp: 850, isCurrent: false, avatar: "🤖" },
    { id: "U_06", name: "Daniela M.", career: "Medicina Humana (San Marcos)", streak: "2 días", xp: 720, isCurrent: false, avatar: "🩺" }
];

document.addEventListener("DOMContentLoaded", () => {
    // Inicializar cargas de interfaz
    buildRankingProfileBanner();
    renderLeaderboardTable();

    // Apagado automático del cargador de red modular
    setTimeout(() => {
        const preloader = document.getElementById("app-preloader");
        if (preloader) preloader.classList.add("fade-out-loader");
    }, 350);
});

// Generar dinámicamente el Banner de Perfil Express Superior
function buildRankingProfileBanner() {
    const container = document.getElementById("ranking-profile-summary");
    if (!container) return;

    container.innerHTML = `
        <div class="profile-express-left">
            <div class="profile-express-avatar">${activeStudentProfile.avatar}</div>
            <div class="profile-express-welcome">
                <h3>Liga de ${activeStudentProfile.name}</h3>
                <p>${activeStudentProfile.target} • ${activeStudentProfile.career}</p>
            </div>
        </div>
        <div class="profile-express-stats">
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--green);">${activeStudentProfile.totalXp}</span>
                <span class="express-stat-label">Mis XP Semanales</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--amber);">🔥 ${activeStudentProfile.streakDays}</span>
                <span class="express-stat-label">Racha Activa</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--indigo);">${activeStudentProfile.rankingPos}</span>
                <span class="express-stat-label">Puesto Aula</span>
            </div>
        </div>
    `;
}

// Renderizar la tabla de clasificación interactiva
function renderLeaderboardTable() {
    const tbody = document.getElementById("leaderboard-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    classroomLeaderboardData.forEach((student, index) => {
        const row = document.createElement("tr");
        
        // 1. Si coincide que es el alumno logueado, inyectamos clase de resaltado
        if (student.isCurrent) {
            row.className = "current-user-highlight";
        }

        // 2. Formatear visualmente el número de puesto (Podio Top 3)
        let puestoLabel = index + 1;
        if (puestoLabel === 1) puestoLabel = `<span class="rank-badge-cell rank-1">🥇 1</span>`;
        else if (puestoLabel === 2) puestoLabel = `<span class="rank-badge-cell rank-2">🥈 2</span>`;
        else if (puestoLabel === 3) puestoLabel = `<span class="rank-badge-cell rank-3">🥉 3</span>`;
        else puestoLabel = `<span class="rank-badge-cell" style="color: var(--sub);">${puestoLabel}</span>`;

        // 3. Evaluar microcopy personalizado si es el mismo usuario
        const nameDisplay = student.isCurrent ? `<strong>${student.name} (Tú)</strong>` : student.name;

        row.innerHTML = `
            <td style="text-align: center;">${puestoLabel}</td>
            <td>
                <div class="student-row-info">
                    <span class="student-avatar-mini">${student.avatar}</span>
                    <span>${nameDisplay}</span>
                </div>
            </td>
            <td class="sub-meta-text">${student.career}</td>
            <td style="text-align: center; font-weight: 500; font-size: 13px;">🔥 ${student.streak}</td>
            <td class="xp-points-cell">${student.xp.toLocaleString()} XP</td>
        `;

        tbody.appendChild(row);
    });
}