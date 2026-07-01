// ==========================================================================
// assets/js/student/rankings.js
// CONTROLADOR LOGICO DEL LEADERBOARD ACADÉMICO
// ==========================================================================

// assets/js/student/rankings.js

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
                <p>Meta: <span data-user-target></span> • <span data-user-career></span></p>
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

async function renderLeaderboardTable() {
    const tbody = document.getElementById("leaderboard-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    try {
        const [rankRes, usersRes] = await Promise.all([
            fetch("../../mock/rankings.json"),
            fetch("../../mock/users.json")
        ]);
        
        const rankings = await rankRes.json();
        const usersData = await usersRes.json();
        const users = usersData.users;

        let activeUserId = null;
        if (window.CurrentUserService) {
            const profile = CurrentUserService.getProfile();
            if (profile) activeUserId = profile.id;
        }

        const combinedRanking = rankings.map(r => {
            const u = users.find(user => user.id === r.userId) || {};
            return {
                id: u.id,
                name: u.name || "Usuario Desconocido",
                career: u.career || u.target || "Preuniversitario",
                streak: r.streakDays + " días",
                xp: r.xp,
                avatar: u.avatar || "👤",
                isCurrent: activeUserId === u.id
            };
        });

        combinedRanking.sort((a, b) => b.xp - a.xp);

        combinedRanking.forEach((student, index) => {
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
    } catch(err) {
        console.error("Error building dynamic ranking:", err);
    }
}