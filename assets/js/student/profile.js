/**
 * @fileoverview Controlador de la vista de perfil de usuario.
 * Único punto de edición: modal premium "Editar Perfil".
 * Elimina el dropdown de avatar del avatar directamente.
 */

document.addEventListener("DOMContentLoaded", async () => {
    if (window.CurrentUserService) {
        await CurrentUserService.init();
    }
    loadProfileData();

    // Ocultar preloader
    setTimeout(() => {
        const preloader = document.getElementById("app-preloader");
        if (preloader) {
            preloader.style.opacity = "0";
            setTimeout(() => preloader.remove(), 400);
        }
    }, 350);

    // Cerrar modal al hacer clic en el overlay
    const overlay = document.getElementById("edit-profile-modal");
    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeEditProfileModal();
        });
    }

    // Cerrar modal con Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeEditProfileModal();
    });
});

/* ====================================================================
   CARGA DE DATOS DEL PERFIL
   ==================================================================== */
function loadProfileData() {
    const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
    if (!user) return;

    const avatarRaw = user.avatar_url || '🚀|#7F77DD';
    const { emoji, color } = window.parseAvatar(avatarRaw);

    // Actualizar avatar en el encabezado
    const avatarDisplay = document.getElementById("profile-avatar-display");
    if (avatarDisplay) avatarDisplay.style.backgroundColor = color;
    const avatarEmoji = document.getElementById("profile-current-avatar");
    if (avatarEmoji) avatarEmoji.innerText = emoji;

    // Datos de nombre y email
    const name = CurrentUserService.getName();
    document.getElementById("profile-full-name").innerText = name || 'Sin nombre';
    document.getElementById("profile-email").innerText = CurrentUserService.getEmail();

    // Badges de meta y carrera
    const targetUni = CurrentUserService.getStat('target') || "UNI";
    document.getElementById("profile-uni-target").innerText = `Meta: ${targetUni}`;
    document.getElementById("profile-career").innerText = CurrentUserService.getStat('career') || "Por elegir";

    // Stats rápidas del header
    const xp = CurrentUserService.getStat('totalXp') || 0;
    const streak = CurrentUserService.getStat('streakDays') || 0;
    document.getElementById("profile-xp-value").innerText = Number(xp).toLocaleString() + " XP";
    document.getElementById("profile-streak-value").innerText = `🔥 ${streak}`;

    // Panel de métricas detalladas
    document.getElementById("stats-total-xp").innerText = Number(xp).toLocaleString();
    document.getElementById("stats-streak-days").innerText = `${streak} ${streak === 1 ? 'día' : 'días'}`;
    document.getElementById("stats-completed-quizzes").innerText = parseInt(localStorage.getItem('completedTopicsCount') || '0', 10);
    document.getElementById("stats-completed-challenges").innerText = parseInt(localStorage.getItem('completedChallengesCount') || '0', 10);

    // Insignias
    renderBadgesShowcase(user);
}

/* ====================================================================
   INSIGNIAS
   ==================================================================== */
function renderBadgesShowcase(user) {
    const container = document.getElementById("badges-gallery-container");
    if (!container) return;

    container.innerHTML = "";
    const unlockedBadges = user.badges || [];
    let unlockedCount = 0;
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

    document.getElementById("badges-unlocked-ratio").innerText = `${unlockedCount} / ${badgesList.length} Desbloqueadas`;
}

/* ====================================================================
   MODAL DE EDICIÓN — APERTURA Y CIERRE CON ANIMACIÓN
   ==================================================================== */
function openEditProfileModal() {
    const modal = document.getElementById("edit-profile-modal");
    if (!modal) return;

    // Pre-cargar valores actuales del usuario
    const name = CurrentUserService.getName();
    const bio = CurrentUserService.getProfile()?.bio || '';
    const avatarRaw = CurrentUserService.getProfile()?.avatar_url || '🚀|#7F77DD';
    const { emoji, color } = window.parseAvatar(avatarRaw);

    // Rellenar campo de nombre y bio
    document.getElementById("edit-name").value = name;
    document.getElementById("edit-bio").value = bio;

    // Actualizar preview
    updatePreviewName(name);
    updatePreviewAvatar(emoji, color);

    // Marcar selección actual de emoji
    document.querySelectorAll("#pedit-emoji-grid .pedit-emoji-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.emoji === emoji);
    });

    // Marcar selección actual de color
    document.querySelectorAll("#pedit-color-grid .pedit-color-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.color === color);
    });

    // Guardar valores en hiddens
    document.getElementById("edit-avatar-emoji").value = emoji;
    document.getElementById("edit-avatar-color").value = color;

    // Mostrar modal con animación
    modal.classList.add("open");
    document.body.style.overflow = "hidden";

    // Hacer focus en el input de nombre
    setTimeout(() => {
        const nameInput = document.getElementById("edit-name");
        if (nameInput) nameInput.focus();
    }, 300);
}

function closeEditProfileModal() {
    const modal = document.getElementById("edit-profile-modal");
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
}

/* ====================================================================
   SELECCIÓN INTERACTIVA DE EMOJI Y COLOR — CON PREVIEW EN VIVO
   ==================================================================== */
function selectEmoji(emoji, btn) {
    // Marcar selección
    document.querySelectorAll("#pedit-emoji-grid .pedit-emoji-btn").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");

    // Guardar valor
    document.getElementById("edit-avatar-emoji").value = emoji;

    // Animación de pop en el preview
    const currentColor = document.getElementById("edit-avatar-color").value;
    updatePreviewAvatar(emoji, currentColor);
}

function selectColor(color, btn) {
    // Marcar selección
    document.querySelectorAll("#pedit-color-grid .pedit-color-btn").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");

    // Guardar valor
    document.getElementById("edit-avatar-color").value = color;

    // Actualizar preview con el nuevo color
    const currentEmoji = document.getElementById("edit-avatar-emoji").value;
    updatePreviewAvatar(currentEmoji, color);
}

function updatePreviewAvatar(emoji, color) {
    const previewCircle = document.getElementById("pedit-avatar-preview-circle");
    const previewEmoji = document.getElementById("pedit-avatar-emoji-preview");

    if (previewCircle) {
        previewCircle.style.transform = "scale(0.85)";
        previewCircle.style.opacity = "0.6";
        setTimeout(() => {
            previewCircle.style.backgroundColor = color;
            if (previewEmoji) previewEmoji.innerText = emoji;
            previewCircle.style.transform = "scale(1)";
            previewCircle.style.opacity = "1";
        }, 150);
        previewCircle.style.transition = "all 0.15s ease";
    }
}

function updatePreviewName(value) {
    const previewName = document.getElementById("pedit-preview-name");
    if (previewName) {
        previewName.innerText = value.trim() || "Tu nombre";
    }
}

/* ====================================================================
   GUARDADO DEL PERFIL
   ==================================================================== */
async function saveUserProfile(event) {
    event.preventDefault();
    const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
    if (!user) return;

    const newName = document.getElementById("edit-name").value.trim();
    const newBio = document.getElementById("edit-bio").value.trim();
    const newEmoji = document.getElementById("edit-avatar-emoji").value;
    const newColor = document.getElementById("edit-avatar-color").value;

    if (!newName) {
        // Shake animation en el input vacío
        const input = document.getElementById("edit-name");
        input.style.borderColor = "var(--red)";
        input.style.boxShadow = "0 0 0 4px rgba(226,75,74,0.15)";
        input.focus();
        setTimeout(() => {
            input.style.borderColor = "";
            input.style.boxShadow = "";
        }, 2000);
        return;
    }

    // Estado de carga del botón
    const saveBtn = document.getElementById("pedit-save-btn");
    const labelEl = saveBtn.querySelector(".pedit-save-label");
    const loadingEl = saveBtn.querySelector(".pedit-save-loading");
    saveBtn.disabled = true;
    labelEl.style.display = "none";
    loadingEl.style.display = "flex";

    const compositeAvatar = `${newEmoji}|${newColor}`;

    try {
        const updates = { name: newName, bio: newBio, avatar_url: compositeAvatar };

        if (window.UserManager) {
            await UserManager.updateProfile(user.id, updates);
        }

        // Actualizar caché local
        user.name = newName;
        user.bio = newBio;
        user.avatar_url = compositeAvatar;

        // Recargar datos en la UI
        loadProfileData();

        // Sincronizar topbar y sidebar
        if (window.UserBindingManager) UserBindingManager.bindAll();

        closeEditProfileModal();

        // Toast de éxito
        if (window.app?.showToast) {
            window.app.showToast("✨ ¡Perfil actualizado con éxito!", "success");
        }
    } catch (err) {
        console.error("Error al actualizar perfil:", err);
        if (window.app?.showToast) window.app.showToast("❌ Error al guardar los cambios", "error");
    } finally {
        // Restaurar botón
        saveBtn.disabled = false;
        labelEl.style.display = "flex";
        loadingEl.style.display = "none";
    }
}

/* Exponer al contexto global */
window.openEditProfileModal = openEditProfileModal;
window.closeEditProfileModal = closeEditProfileModal;
window.saveUserProfile = saveUserProfile;
window.selectEmoji = selectEmoji;
window.selectColor = selectColor;
window.updatePreviewName = updatePreviewName;
window.loadProfileData = loadProfileData;
