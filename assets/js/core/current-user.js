/**
 * @fileoverview Servicio de persistencia y acceso al estado del usuario activo.
 * Actúa como una capa de caché en memoria sobre el UserManager, proveyendo métodos
 * síncronos para extraer propiedades del perfil y estadísticas del usuario autenticado.
 * También incluye un gestor para vincular (binding) estos datos directamente al DOM.
 */

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
    getId(){
        return this.getProfile()?.id || '';
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
     * Extraer un valor específico del subobjeto profile.
     * @param {string} key - Clave del perfil a consultar.
     * @returns {any} Valor correspondiente a la clave o string vacío.
     */
    getProfileField(key) {
        return this.getProfile()?.profile?.[key] || '';
    },

    /**
     * Extraer un valor específico del subobjeto stats.
     * @param {string} key - Clave de estadística a consultar.
     * @returns {any} Valor de la estadística o string vacío.
     */
    getStatField(key) {
        return this.getProfile()?.stats?.[key] || '';
    },

    /**
     * Consultar métricas o propiedades asegurando retrocompatibilidad estructural.
     * Explora jerárquicamente: stats > mapeos estáticos > profile > raíz.
     * @param {string} key - Clave de la propiedad requerida.
     * @returns {any} Valor resuelto de la propiedad.
     */
    getStat(key) {
        const user = this.getProfile();
        if (!user) return '';

        // Buscar prioridad en objeto de estadísticas o propiedades directas de base de datos
        if (user.stats && user.stats[key] !== undefined) return user.stats[key];
        
        // Aplicar mapeos de compatibilidad entre el esquema actual y la estructura legada
        if (key === 'totalXp' && user.total_xp !== undefined) return user.total_xp;
        if (key === 'streakDays' && user.streak_days !== undefined) return user.streak_days;
        if (key === 'target' && user.target_university_id !== undefined) return user.target_university_id;

        // Buscar en subobjeto de perfil anidado
        if (user.profile && user.profile[key] !== undefined) return user.profile[key];

        // Fallback a propiedades en la raíz del documento para preservar retrocompatibilidad
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