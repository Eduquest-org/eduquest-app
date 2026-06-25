// assets/js/student/gamification.js
// MOTOR CENTRALIZADO DE GAMIFICACIÓN — ED UQUEST

const AVAILABLE_BADGES = [
    {
        id: "badge_diagnostic",
        name: "Primer Diagnóstico",
        description: "Completa tu examen diagnóstico inicial.",
        icon: "🧭",
        colorClass: "badge-blue",
        xpReward: 200
    },
    {
        id: "badge_streak_3",
        name: "Estudiante Constante",
        description: "Alcanza una racha de 3 días de estudio.",
        icon: "🔥",
        colorClass: "badge-orange",
        xpReward: 300
    },
    {
        id: "badge_challenge_1",
        name: "Primer Reto",
        description: "Completa tu primer reto diario con éxito.",
        icon: "🎯",
        colorClass: "badge-green",
        xpReward: 150
    },
    {
        id: "badge_challenge_3",
        name: "Cazador de Retos",
        description: "Completa 3 retos diarios.",
        icon: "🏆",
        colorClass: "badge-gold",
        xpReward: 500
    },
    {
        id: "badge_perfect_score",
        name: "Perfección Absoluta",
        description: "Completa cualquier simulacro con el 100% de aciertos.",
        icon: "💯",
        colorClass: "badge-purple",
        xpReward: 400
    },
    {
        id: "badge_curious",
        name: "Líder de Opinión",
        description: "Publica una duda académica en la comunidad.",
        icon: "💬",
        colorClass: "badge-teal",
        xpReward: 100
    }
];

const CHALLENGE_TEMPLATES = [
    {
        description: "Resuelve 3 preguntas correctas en cualquier simulacro",
        type: "quiz_questions",
        target: 3,
        xpReward: 150
    },
    {
        description: "Suma 200 XP en total resolviendo retos académicos",
        type: "total_xp",
        target: 200,
        xpReward: 100
    },
    {
        description: "Publica una duda académica en la comunidad para debatir",
        type: "create_post",
        target: 1,
        xpReward: 100
    },
    {
        description: "Completa al menos 1 simulacro o examen completo",
        type: "complete_quiz",
        target: 1,
        xpReward: 150
    }
];

const GamificationManager = {
    init() {
        const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
        if (!user) return;

        // 1. Inicializar Reto Diario si no existe o es de otro día
        this.initDailyChallenge(user);

        // 2. Verificar Insignias Automáticas
        this.checkAutomaticMilestones(user);
    },

    initDailyChallenge(user, forceReset = false) {
        if (!user.stats) user.stats = {};
        
        const todayStr = new Date().toDateString();
        // Intentar recuperar de localStorage
        let activeChallenge = null;
        try { activeChallenge = JSON.parse(localStorage.getItem('dailyChallenge')); } catch (e) {}
        
        if (activeChallenge) {
            user.stats.dailyChallenge = activeChallenge;
        }

        if (forceReset || !activeChallenge || activeChallenge.date !== todayStr) {
            // Seleccionar un reto aleatorio de las plantillas
            const randTemplate = CHALLENGE_TEMPLATES[Math.floor(Math.random() * CHALLENGE_TEMPLATES.length)];
            
            user.stats.dailyChallenge = {
                description: randTemplate.description,
                type: randTemplate.type,
                target: randTemplate.target,
                current: 0,
                completed: false,
                xpReward: randTemplate.xpReward,
                date: todayStr
            };
            
            // Guardar localmente ya que no existe columna 'dailyChallenge' en Supabase
            localStorage.setItem('dailyChallenge', JSON.stringify(user.stats.dailyChallenge));
        }
    },

    updateDailyChallengeProgress(type, amount) {
        const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
        if (!user || !user.stats || !user.stats.dailyChallenge) return;

        const challenge = user.stats.dailyChallenge;
        if (challenge.completed || challenge.type !== type) return;

        challenge.current = Math.min(challenge.target, challenge.current + amount);

        // Guardar progreso localmente
        localStorage.setItem('dailyChallenge', JSON.stringify(challenge));

        if (challenge.current >= challenge.target) {
            challenge.completed = true;
            localStorage.setItem('dailyChallenge', JSON.stringify(challenge));
            
            // Recompensar al usuario con XP
            UserManager.addXp(user.id, challenge.xpReward);
            
            // Incrementar retos completados totales en stats
            const completedCount = (user.stats.completedChallengesCount || 0) + 1;
            user.stats.completedChallengesCount = completedCount;
            localStorage.setItem('completedChallengesCount', completedCount.toString());

            // Mostrar modal de felicitación
            this.showCelebrationModal(
                "¡Reto Diario Cumplido!",
                challenge.description,
                "🎯",
                challenge.xpReward
            );

            // Verificar si el usuario desbloquea insignias por completar retos
            this.checkChallengeMilestones(user.id, completedCount);
        } else {
            // Ya hemos guardado en localStorage en la línea 135
        }

        // Refrescar enlaces e interfaces
        if (window.UserBindingManager) UserBindingManager.bindAll();
        if (typeof renderDailyChallengeWidget === 'function') renderDailyChallengeWidget();
    },

    checkAutomaticMilestones(user) {
        // A. Verificar diagnóstico completado
        if (user.learningProgress && user.learningProgress.diagnosticResults && user.learningProgress.diagnosticResults.length > 0) {
            this.checkAndAwardBadge(user.id, "badge_diagnostic");
        }

        // B. Verificar racha de días
        if (user.stats && user.stats.streakDays >= 3) {
            this.checkAndAwardBadge(user.id, "badge_streak_3");
        }
    },

    checkChallengeMilestones(userId, completedCount) {
        if (completedCount >= 1) {
            this.checkAndAwardBadge(userId, "badge_challenge_1");
        }
        if (completedCount >= 3) {
            this.checkAndAwardBadge(userId, "badge_challenge_3");
        }
    },

    checkAndAwardBadge(userId, badgeId) {
        const user = CurrentUserService.getProfile();
        if (!user) return;

        if (!user.profile) user.profile = {};
        if (!user.profile.badges) user.profile.badges = [];

        // Si ya tiene la insignia, no hacer nada
        if (user.profile.badges.includes(badgeId)) return;

        // Obtener datos de la insignia
        const badge = AVAILABLE_BADGES.find(b => b.id === badgeId);
        if (!badge) return;

        // Otorgar insignia
        user.profile.badges.push(badgeId);
        UserManager.updateProfile(userId, { badges: user.profile.badges });

        // Otorgar XP
        UserManager.addXp(userId, badge.xpReward);

        // Desplegar Modal Celebración
        this.showCelebrationModal(
            "¡Insignia Desbloqueada!",
            `Has ganado la medalla **${badge.name}**<br>${badge.description}`,
            badge.icon,
            badge.xpReward
        );

        // Actualizar UI
        if (window.UserBindingManager) UserBindingManager.bindAll();
    },

    showCelebrationModal(title, subtitle, icon, xpReward) {
        // Eliminar si ya hay uno abierto
        const existing = document.getElementById("gamification-modal");
        if (existing) existing.remove();

        // Crear contenedor principal
        const modal = document.createElement("div");
        modal.id = "gamification-modal";
        modal.className = "game-modal-overlay";

        // Inyectar HTML
        modal.innerHTML = `
            <div class="game-modal-card">
                <div class="game-modal-confetti-anchor" id="confetti-anchor"></div>
                <div class="game-modal-close" onclick="document.getElementById('gamification-modal').remove()">×</div>
                <div class="game-modal-icon-container">
                    <span class="game-modal-icon-main">${icon}</span>
                </div>
                <h2 class="game-modal-title">${title}</h2>
                <p class="game-modal-sub">${subtitle}</p>
                <div class="game-modal-xp-pill">+${xpReward} XP</div>
                <button class="game-modal-btn" onclick="document.getElementById('gamification-modal').remove()">¡Espectacular!</button>
            </div>
        `;

        document.body.appendChild(modal);

        // Generar confeti por CSS
        const anchor = modal.querySelector("#confetti-anchor");
        const colors = ["#1D9E75", "#EF9F27", "#7F77DD", "#E24B4A", "#3498DB", "#E74C3C"];
        
        for (let i = 0; i < 60; i++) {
            const confettiPiece = document.createElement("div");
            confettiPiece.className = "confetti-piece";
            confettiPiece.style.left = Math.random() * 100 + "%";
            confettiPiece.style.top = -10 + Math.random() * -10 + "px";
            confettiPiece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confettiPiece.style.width = 6 + Math.random() * 10 + "px";
            confettiPiece.style.height = 10 + Math.random() * 10 + "px";
            confettiPiece.style.animationDelay = Math.random() * 2000 + "ms";
            confettiPiece.style.transform = `rotate(${Math.random() * 360}deg)`;
            anchor.appendChild(confettiPiece);
        }

        // Auto remover después de 8 segundos si no se interactúa
        setTimeout(() => {
            const currentModal = document.getElementById("gamification-modal");
            if (currentModal) {
                currentModal.classList.add("game-modal-fadeout");
                setTimeout(() => currentModal.remove(), 400);
            }
        }, 8000);
    }
};

// Auto inicializar al cargar si se incluye el script
document.addEventListener("DOMContentLoaded", async () => {
    if (window.CurrentUserService) {
        await CurrentUserService.init();
    }
    GamificationManager.init();
});

window.GamificationManager = GamificationManager;
window.AVAILABLE_BADGES = AVAILABLE_BADGES;
