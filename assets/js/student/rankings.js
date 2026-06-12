// ==========================================================================
// assets/js/student/rankings.js
// CONTROLADOR LOGICO DEL LEADERBOARD ACADÉMICO
// ==========================================================================

// assets/js/student/rankings.js

const classroomLeaderboardData = [
    { id: "U_01", name: "Matias Del Castillo", career: "Ing. de Sistemas (UNI)", streak: "12 días", xp: 1420, isCurrent: false, avatar: "🎓" },
    { id: "U_02", name: "Vanessa Barrientos", career: "Ing. Industrial (UNI)", streak: "8 días", xp: 1280, isCurrent: false, avatar: "🧠" },
    { id: "U_CHRIS", name: "Chris Carrasco", career: "Ing. de Sistemas (UNI)", streak: "3 días", xp: 1150, isCurrent: true, avatar: "✨" }, 
    { id: "U_03", name: "Mateo Del Carpio", career: "Ciencias de la Computación (UNI)", streak: "5 días", xp: 980, isCurrent: false, avatar: "💻" },
    { id: "U_04", name: "Vivianne Rios", career: "Ing. Civil (PUCP)", streak: "14 días", xp: 910, isCurrent: false, avatar: "🎨" },
    { id: "U_05", name: "Alexander K.", career: "Ing. Mecrónica (UNI)", streak: "0 días", xp: 850, isCurrent: false, avatar: "🤖" },
    { id: "U_06", name: "Daniela M.", career: "Medicina Humana (San Marcos)", streak: "2 días", xp: 720, isCurrent: false, avatar: "🩺" }
];

document.addEventListener("DOMContentLoaded", () => {
    buildRankingProfileBanner();
    renderLeaderboardTable();

    setTimeout(() => {
        const preloader = document.getElementById("app-preloader");
        if (preloader) preloader.classList.add("fade-out-loader");
    }, 350);
});

function buildRankingProfileBanner() {
    const container = document.getElementById("ranking-profile-summary");
    if (!container) return;

    container.innerHTML = `
        <div class="profile-express-left">
            <div class="profile-express-avatar" data-user-avatar></div>
            <div class="profile-express-welcome">
                <h3>Liga de <span data-user-firstname></span></h3>
                <p><span data-user-target></span> • <span data-user-career></span></p>
            </div>
        </div>
        <div class="profile-express-stats">
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--green);" data-user-xp></span>
                <span class="express-stat-label">Mis XP Semanales</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--amber);">🔥 <span data-user-streak></span></span>
                <span class="express-stat-label">Racha Activa</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--indigo);" data-user-ranking></span>
                <span class="express-stat-label">Puesto Aula</span>
            </div>
        </div>
    `;

    if (window.UserBindingManager) UserBindingManager.bindAll();
}

function renderLeaderboardTable() {
    const tbody = document.getElementById("leaderboard-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (window.CurrentUserService) {
        const profile = CurrentUserService.getProfile();
        const currentUserIndex = classroomLeaderboardData.findIndex(u => u.isCurrent);
        if (currentUserIndex !== -1 && profile) {
            classroomLeaderboardData[currentUserIndex].id = profile.id;
            classroomLeaderboardData[currentUserIndex].name = profile.name;
            classroomLeaderboardData[currentUserIndex].career = profile.career;
            classroomLeaderboardData[currentUserIndex].streak = (profile.streakDays || 0) + " días";
            classroomLeaderboardData[currentUserIndex].xp = profile.totalXp || 0;
            classroomLeaderboardData[currentUserIndex].avatar = profile.avatar || "✨";
        }
    }

    classroomLeaderboardData.forEach((student, index) => {
        const row = document.createElement("tr");
        
        if (student.isCurrent) {
            row.className = "current-user-highlight";
        }

        let puestoLabel = index + 1;
        if (puestoLabel === 1) puestoLabel = `<span class="rank-badge-cell rank-1">🥇 1</span>`;
        else if (puestoLabel === 2) puestoLabel = `<span class="rank-badge-cell rank-2">🥈 2</span>`;
        else if (puestoLabel === 3) puestoLabel = `<span class="rank-badge-cell rank-3">🥉 3</span>`;
        else puestoLabel = `<span class="rank-badge-cell" style="color: var(--sub);">${puestoLabel}</span>`;

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
            <td class="xp-points-cell">${Number(student.xp).toLocaleString()} XP</td>
        `;

        tbody.appendChild(row);
    });
}