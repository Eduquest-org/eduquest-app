// ==========================================================================
// assets/js/core/current-user.js
// SERVICIO DE LECTURA DEL USUARIO ACTIVO (sesión actual)
// ==========================================================================
// Lee datos del usuario logueado usando UserManager.
// Provee acceso rápido a nombre, email, avatar, stats, profile, etc.
// ==========================================================================

let currentUserCache = null;

const CurrentUserService = {
    async init() {
        if (window.UserManager) {
            currentUserCache = await UserManager.getCurrentUserDoc();
        }
        return currentUserCache;
    },
    getProfile() {
        return currentUserCache;
    },
    getName() {
        return this.getProfile()?.name || '';
    },
    getFirstName() {
        return this.getName().split(' ')[0] || '';
    },
    getLastName() {
        const parts = this.getName().split(' ');
        return parts.length > 1 ? parts.slice(1).join(' ') : '';
    },
    getEmail() {
        return this.getProfile()?.email || '';
    },
    getRole() {
        return this.getProfile()?.role || '';
    },
    getAvatar() {
        return this.getProfile()?.avatar_url || this.getProfile()?.profile?.avatar || '👤';
    },
    getInitials() {
        const name = this.getName();
        if (!name) return 'U';
        const parts = name.split(' ');
        return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name[0].toUpperCase();
    },

    /**
     * Obtiene un valor del subobjeto `profile` del usuario.
     * Ej: getProfileField('target') → "UNI"
     */
    getProfileField(key) {
        return this.getProfile()?.profile?.[key] || '';
    },

    /**
     * Obtiene un valor del subobjeto `stats` del usuario.
     * Ej: getStatField('totalXp') → 1150
     */
    getStatField(key) {
        return this.getProfile()?.stats?.[key] || '';
    },

    /**
     * Retrocompatible con el uso anterior de getStat(key).
     * Busca primero en `stats`, luego en `profile`, luego en raíz.
     */
    getStat(key) {
        const user = this.getProfile();
        if (!user) return '';

        // Buscar en stats (o directamente en properties que vienen de Supabase como total_xp)
        if (user.stats && user.stats[key] !== undefined) return user.stats[key];
        
        // Mapeos comunes de Supabase a los nombres antiguos
        if (key === 'totalXp' && user.total_xp !== undefined) return user.total_xp;
        if (key === 'streakDays' && user.streak_days !== undefined) return user.streak_days;
        if (key === 'target' && user.target_university_id !== undefined) return user.target_university_id;

        // Buscar en profile
        if (user.profile && user.profile[key] !== undefined) return user.profile[key];

        // Buscar en raíz (retrocompatibilidad para datos no migrados)
        if (user[key] !== undefined) return user[key];

        return '';
    }
};

const UserBindingManager = {
    bindAll() {
        if (!CurrentUserService.getProfile()) return;

        document.querySelectorAll('[data-user-name]').forEach(el => el.innerHTML = CurrentUserService.getName());
        document.querySelectorAll('[data-user-firstname]').forEach(el => el.innerHTML = CurrentUserService.getFirstName());
        document.querySelectorAll('[data-user-lastname]').forEach(el => el.innerHTML = CurrentUserService.getLastName());
        document.querySelectorAll('[data-user-email]').forEach(el => el.innerHTML = CurrentUserService.getEmail());
        document.querySelectorAll('[data-user-role]').forEach(el => el.innerHTML = CurrentUserService.getRole());
        document.querySelectorAll('[data-user-avatar]').forEach(el => {
            if (el.tagName.toLowerCase() === 'img') {
                el.src = CurrentUserService.getAvatar();
            } else {
                el.innerHTML = CurrentUserService.getAvatar();
            }
        });
        document.querySelectorAll('[data-user-initials]').forEach(el => el.innerHTML = CurrentUserService.getInitials());

        document.querySelectorAll('[data-user-target]').forEach(el => el.innerHTML = CurrentUserService.getStat('target'));
        document.querySelectorAll('[data-user-career]').forEach(el => el.innerHTML = CurrentUserService.getStat('career'));
        document.querySelectorAll('[data-user-xp]').forEach(el => {
            const xp = CurrentUserService.getStat('totalXp');
            el.innerHTML = xp ? Number(xp).toLocaleString() + ' XP' : '0 XP';
        });
        document.querySelectorAll('[data-user-streak]').forEach(el => el.innerHTML = CurrentUserService.getStat('streakDays') || '0');
        document.querySelectorAll('[data-user-ranking]').forEach(el => el.innerHTML = CurrentUserService.getStat('rankingPos') || 'N/A');
    }
};

window.CurrentUserService = CurrentUserService;
window.UserBindingManager = UserBindingManager;