// assets/js/student/profile.js
// CONTROLADOR DE PANTALLA DE PERFIL Y VITRINA DE LOGROS

document.addEventListener("DOMContentLoaded", () => {
    loadProfileData();

    // Auto-ocultar preloader
    setTimeout(() => {
        const preloader = document.getElementById("app-preloader");
        if (preloader) {
            preloader.style.opacity = "0";
            setTimeout(() => preloader.remove(), 400);
        }
    }, 350);

    // Cerrar dropdown de avatar si se hace click en otro lado
    document.addEventListener("click", (e) => {
        const btn = document.getElementById("profile-avatar-btn");
        const dropdown = document.getElementById("avatar-dropdown");
        if (btn && dropdown && !btn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove("active");
        }
    });
});

function loadProfileData() {
    const session = Storage.getSession();
    if (!session) return;

    const user = UserManager.getUserById(session.userId);
    if (!user) return;

    // 1. Rellenar Información del Encabezado
    document.getElementById("profile-current-avatar").innerText = user.profile?.avatar || "🚀";
    document.getElementById("profile-full-name").innerText = user.name || "Estudiante";
    document.getElementById("profile-email").innerText = user.email || "";
    
    const targetUni = user.profile?.target || "UNI";
    document.getElementById("profile-uni-target").innerText = `Meta: ${targetUni}`;
    document.getElementById("profile-career").innerText = user.profile?.career || "Por elegir";

    // 2. Rellenar Estadísticas Rápidas
    const xp = user.stats?.totalXp || 0;
    const streak = user.stats?.streakDays || 0;
    document.getElementById("profile-xp-value").innerText = Number(xp).toLocaleString() + " XP";
    document.getElementById("profile-streak-value").innerText = `🔥 ${streak}`;

    // 3. Rellenar Panel de Estadísticas del Cuerpo
    document.getElementById("stats-total-xp").innerText = Number(xp).toLocaleString();
    document.getElementById("stats-streak-days").innerText = `${streak} ${streak === 1 ? 'día' : 'días'}`;
    
    // Contar simulacros resueltos basados en completedTopics
    const completedQuizzesCount = user.learningProgress?.completedTopics?.length || 0;
    document.getElementById("stats-completed-quizzes").innerText = completedQuizzesCount;

    // Retos Diarios Cumplidos
    const completedChallengesCount = user.stats?.completedChallengesCount || 0;
    document.getElementById("stats-completed-challenges").innerText = completedChallengesCount;

    // 4. Renderizar Rejilla de Insignias (Vitrina)
    renderBadgesShowcase(user);
}

function renderBadgesShowcase(user) {
    const container = document.getElementById("badges-gallery-container");
    if (!container) return;

    container.innerHTML = "";
    
    const unlockedBadges = user.profile?.badges || [];
    let unlockedCount = 0;

    // AVAILABLE_BADGES viene declarado globalmente en gamification.js
    const badgesList = window.AVAILABLE_BADGES || [];

    badgesList.forEach(badge => {
        const isUnlocked = unlockedBadges.includes(badge.id);
        if (isUnlocked) unlockedCount++;

        const badgeCard = document.createElement("div");
        badgeCard.className = `badge-item-card ${isUnlocked ? 'unlocked' : 'locked'}`;

        badgeCard.innerHTML = `
            <div class="badge-card-icon">${badge.icon}</div>
            <div class="badge-card-name">${badge.name}</div>
            <div class="badge-card-desc">${badge.description}</div>
            <div class="badge-card-status-pill">${isUnlocked ? 'Desbloqueada' : 'Bloqueada'}</div>
        `;

        container.appendChild(badgeCard);
    });

    // Actualizar indicador de fracción desbloqueada
    document.getElementById("badges-unlocked-ratio").innerText = `${unlockedCount} / ${badgesList.length} Desbloqueadas`;
}

// Activar o desactivar menú de selección de avatar
function toggleAvatarDropdown() {
    const dropdown = document.getElementById("avatar-dropdown");
    if (dropdown) dropdown.classList.toggle("active");
}

// Cambiar el avatar del usuario interactivo y guardarlo
function changeUserAvatar(emoji) {
    const session = Storage.getSession();
    if (!session) return;

    // Actualizar base de datos local
    UserManager.updateProfile(session.userId, { avatar: emoji });

    // Actualizar interfaz del perfil
    document.getElementById("profile-current-avatar").innerText = emoji;

    // Ocultar dropdown
    const dropdown = document.getElementById("avatar-dropdown");
    if (dropdown) dropdown.classList.remove("active");

    // Sincronizar stats en todo el sistema (incluido Topbar)
    if (window.UserBindingManager) UserBindingManager.bindAll();
}

// Registrar funciones globales
window.toggleAvatarDropdown = toggleAvatarDropdown;
window.changeUserAvatar = changeUserAvatar;
