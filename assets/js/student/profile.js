/**
 * @fileoverview Controlador de la vista de perfil de usuario.
 * Gestiona el renderizado de la información personal, estadísticas agregadas,
 * estado de gamificación (insignias) y personalización del avatar de usuario.
 */

document.addEventListener("DOMContentLoaded", async () => {
    if (window.CurrentUserService) {
        await CurrentUserService.init();
    }
    loadProfileData();

    // Retirar componente de pre-carga de la vista
    setTimeout(() => {
        const preloader = document.getElementById("app-preloader");
        if (preloader) {
            preloader.style.opacity = "0";
            setTimeout(() => preloader.remove(), 400);
        }
    }, 350);

    // Ocultar menú contextual de avatar al perder el foco
    document.addEventListener("click", (e) => {
        const btn = document.getElementById("profile-avatar-btn");
        const dropdown = document.getElementById("avatar-dropdown");
        if (btn && dropdown && !btn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove("active");
        }
    });
});

function loadProfileData() {
    const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
    if (!user) return;

    // Poblar atributos primarios del encabezado de perfil
    document.getElementById("profile-current-avatar").innerText = CurrentUserService.getAvatar();
    document.getElementById("profile-full-name").innerText = CurrentUserService.getName();
    document.getElementById("profile-email").innerText = CurrentUserService.getEmail();
    
    const targetUni = CurrentUserService.getStat('target') || "UNI";
    document.getElementById("profile-uni-target").innerText = `Meta: ${targetUni}`;
    document.getElementById("profile-career").innerText = CurrentUserService.getStat('career') || "Por elegir";

    // Inyectar indicadores estadísticos de alto nivel
    const xp = CurrentUserService.getStat('totalXp') || 0;
    const streak = CurrentUserService.getStat('streakDays') || 0;
    document.getElementById("profile-xp-value").innerText = Number(xp).toLocaleString() + " XP";
    document.getElementById("profile-streak-value").innerText = `🔥 ${streak}`;

    // Poblar panel detallado de métricas
    document.getElementById("stats-total-xp").innerText = Number(xp).toLocaleString();
    document.getElementById("stats-streak-days").innerText = `${streak} ${streak === 1 ? 'día' : 'días'}`;
    
    // Extraer conteo de evaluaciones resueltas desde almacenamiento temporal
    const completedQuizzesCount = parseInt(localStorage.getItem('completedTopicsCount') || '0', 10);
    document.getElementById("stats-completed-quizzes").innerText = completedQuizzesCount;

    // Extraer métrica de retos diarios completados
    const completedChallengesCount = parseInt(localStorage.getItem('completedChallengesCount') || '0', 10);
    document.getElementById("stats-completed-challenges").innerText = completedChallengesCount;

    // Inicializar renderizado de catálogo de insignias
    renderBadgesShowcase(user);
}

function renderBadgesShowcase(user) {
    const container = document.getElementById("badges-gallery-container");
    if (!container) return;

    container.innerHTML = "";
    
    const unlockedBadges = user.badges || [];
    let unlockedCount = 0;

    // Recuperar registro global de insignias disponibles
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

    // Actualizar relación cuantitativa de logros desbloqueados
    document.getElementById("badges-unlocked-ratio").innerText = `${unlockedCount} / ${badgesList.length} Desbloqueadas`;
}

/** Conmutar estado de visibilidad del menú de selección de avatar */
function toggleAvatarDropdown() {
    const dropdown = document.getElementById("avatar-dropdown");
    if (dropdown) dropdown.classList.toggle("active");
}

/** Procesar selección de avatar, persistir y actualizar interfaces */
function changeUserAvatar(emoji) {
    const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
    if (!user) return;

    // Persistir atributo de avatar en base de datos
    user.avatar_url = emoji;
    if (window.UserManager) {
        UserManager.updateProfile(user.id, { avatar_url: emoji });
    }

    // Refrescar componente visual del perfil
    document.getElementById("profile-current-avatar").innerText = emoji;

    // Ocultar menú contextual
    const dropdown = document.getElementById("avatar-dropdown");
    if (dropdown) dropdown.classList.remove("active");

    // Disparar sincronización global de propiedades de usuario
    if (window.UserBindingManager) UserBindingManager.bindAll();
}

// Exponer métodos de control de interfaz al contexto global
window.toggleAvatarDropdown = toggleAvatarDropdown;
window.changeUserAvatar = changeUserAvatar;

/* ====================================================================
   FUNCIONALIDADES DE EDICIÓN DE PERFIL
   ==================================================================== */
function openEditProfileModal() {
    const modal = document.getElementById("edit-profile-modal");
    if (!modal) return;

    // Poblar campos con los datos actuales
    const currentName = CurrentUserService.getName();
    const currentTarget = CurrentUserService.getStat('target') || "UNI";
    const currentCareer = CurrentUserService.getStat('career') || "Ingeniería de Sistemas";

    document.getElementById("edit-name").value = currentName;
    document.getElementById("edit-target").value = currentTarget;
    document.getElementById("edit-career").value = currentCareer;

    modal.style.display = "flex";
}

function closeEditProfileModal() {
    const modal = document.getElementById("edit-profile-modal");
    if (modal) modal.style.display = "none";
}

async function saveUserProfile(event) {
    event.preventDefault();
    const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
    if (!user) return;

    const newName = document.getElementById("edit-name").value.trim();
    const newTarget = document.getElementById("edit-target").value;
    const newCareer = document.getElementById("edit-career").value;

    if (!newName) {
        if (window.app?.showToast) window.app.showToast("⚠️ El nombre no puede estar vacío", "error");
        return;
    }

    // Mostrar loader de carga interactivo
    GlobalLoader.show();

    try {
        // Estructura de actualización que coincide con profiles schema
        const updates = {
            name: newName,
            target_university_id: newTarget,
            career: newCareer
        };

        if (window.UserManager) {
            await UserManager.updateProfile(user.id, updates);
        }

        // Actualizar caché local
        user.name = newName;
        user.target_university_id = newTarget;
        user.career = newCareer;

        // Recargar datos en la UI
        loadProfileData();

        // Disparar sincronización global de propiedades de usuario (topbar, etc.)
        if (window.UserBindingManager) UserBindingManager.bindAll();

        closeEditProfileModal();

        if (window.app?.showToast) {
            window.app.showToast("✨ ¡Perfil actualizado con éxito!", "success");
        }
    } catch (err) {
        console.error("Error al actualizar perfil:", err);
        if (window.app?.showToast) window.app.showToast("❌ Error al guardar los cambios", "error");
    } finally {
        GlobalLoader.hide();
    }
}

window.openEditProfileModal = openEditProfileModal;
window.closeEditProfileModal = closeEditProfileModal;
window.saveUserProfile = saveUserProfile;

