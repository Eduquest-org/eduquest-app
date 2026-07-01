// ==========================================================================
// assets/js/core/user-manager.js
// SERVICIO CENTRALIZADO DE GESTIÓN DE USUARIOS (localStorage)
// ==========================================================================
// Toda lectura/escritura sobre "eduquest_db_users" debe pasar por aquí.
// La sesión (eduquest_session) se gestiona aparte en Storage/Auth.
// ==========================================================================

const UserManager = {

    // ─── Lectura / Escritura Base ────────────────────────────────────

    /**
     * Lee el array completo de usuarios del localStorage.
     * @returns {Array} Lista de objetos de usuario.
     */
    getAllUsers() {
        return JSON.parse(localStorage.getItem('eduquest_db_users')) || [];
    },

    /**
     * Guarda el array completo de usuarios en el localStorage.
     * @param {Array} usersArray - Lista de objetos de usuario.
     */
    saveAllUsers(usersArray) {
        localStorage.setItem('eduquest_db_users', JSON.stringify(usersArray));
    },

    // ─── Búsqueda ───────────────────────────────────────────────────

    /**
     * Busca un usuario por su ID.
     * @param {string} userId
     * @returns {Object|null} El documento del usuario o null.
     */
    getUserById(userId) {
        const users = this.getAllUsers();
        return users.find(u => u.id === userId) || null;
    },

    /**
     * Devuelve el documento completo del usuario que tiene la sesión activa.
     * Requiere que Storage esté disponible globalmente.
     * @returns {Object|null} El documento del usuario logueado o null.
     */
    getCurrentUserDoc() {
        const session = Storage.getSession();
        if (!session) return null;
        return this.getUserById(session.userId);
    },

    // ─── Actualizaciones Parciales ──────────────────────────────────

    /**
     * Actualiza campos dentro de `profile` del usuario.
     * @param {string} userId
     * @param {Object} partialProfile - Ej: { target: "SAN_MARCOS", career: "Medicina" }
     */
    updateProfile(userId, partialProfile) {
        const users = this.getAllUsers();
        const idx = users.findIndex(u => u.id === userId);
        if (idx === -1) return;

        if (!users[idx].profile) users[idx].profile = {};
        Object.assign(users[idx].profile, partialProfile);
        this.saveAllUsers(users);
    },

    /**
     * Actualiza campos dentro de `stats` del usuario.
     * @param {string} userId
     * @param {Object} partialStats - Ej: { streakDays: 4 }
     */
    updateStats(userId, partialStats) {
        const users = this.getAllUsers();
        const idx = users.findIndex(u => u.id === userId);
        if (idx === -1) return;

        if (!users[idx].stats) users[idx].stats = {};
        Object.assign(users[idx].stats, partialStats);
        this.saveAllUsers(users);
    },

    /**
     * Suma XP al total del usuario.
     * @param {string} userId
     * @param {number} amount - Cantidad de XP a sumar.
     * @returns {number} Nuevo total de XP.
     */
    addXp(userId, amount) {
        const users = this.getAllUsers();
        const idx = users.findIndex(u => u.id === userId);
        if (idx === -1) return 0;

        if (!users[idx].stats) users[idx].stats = {};
        const currentXp = users[idx].stats.totalXp || 0;
        users[idx].stats.totalXp = currentXp + amount;
        this.saveAllUsers(users);
        return users[idx].stats.totalXp;
    },

    // ─── Progreso de Aprendizaje ────────────────────────────────────

    /**
     * Marca un tema (topic) como completado y suma XP.
     * Actualiza `lastAccessedTopic` y `lastAccessedCourse`.
     * @param {string} userId
     * @param {string} topicId - ID del tema completado.
     * @param {string} courseId - ID del curso al que pertenece el tema.
     * @param {number} xpEarned - XP ganados por completar el tema.
     * @returns {Object|null} El usuario actualizado o null.
     */
    completeTopicProgress(userId, topicId, courseId, xpEarned) {
        const users = this.getAllUsers();
        const idx = users.findIndex(u => u.id === userId);
        if (idx === -1) return null;

        if (!users[idx].learningProgress) {
            users[idx].learningProgress = {
                lastAccessedCourse: null,
                lastAccessedTopic: null,
                completedTopics: [],
                diagnosticResults: [],
                hardestCourse: null,
                customRoadmap: []
            };
        }

        const progress = users[idx].learningProgress;

        // Marcar tema como completado (sin duplicados)
        if (!progress.completedTopics.includes(topicId)) {
            progress.completedTopics.push(topicId);
        }

        // Actualizar última ubicación
        progress.lastAccessedTopic = topicId;
        progress.lastAccessedCourse = courseId || progress.lastAccessedCourse;

        // Sumar XP
        if (!users[idx].stats) users[idx].stats = {};
        users[idx].stats.totalXp = (users[idx].stats.totalXp || 0) + xpEarned;

        this.saveAllUsers(users);
        return users[idx];
    },

    // ─── Ruta IA Personalizada ──────────────────────────────────────

    /**
     * Guarda la ruta IA generada dentro del documento del usuario.
     * Reemplaza la antigua clave suelta `eduquest_roadmap_{userId}`.
     * @param {string} userId
     * @param {Array} roadmapData - Array de objetos de ruta generados por AIEngine.
     */
    saveCustomRoadmap(userId, roadmapData) {
        const users = this.getAllUsers();
        const idx = users.findIndex(u => u.id === userId);
        if (idx === -1) return;

        if (!users[idx].learningProgress) {
            users[idx].learningProgress = {
                lastAccessedCourse: null,
                lastAccessedTopic: null,
                completedTopics: [],
                diagnosticResults: [],
                hardestCourse: null,
                customRoadmap: []
            };
        }

        users[idx].learningProgress.customRoadmap = roadmapData;

        // Limpiar la clave suelta antigua si existe
        localStorage.removeItem(`eduquest_roadmap_${userId}`);

        this.saveAllUsers(users);
    },

    /**
     * Lee la ruta IA personalizada del usuario.
     * Incluye fallback para migrar datos de la clave suelta antigua.
     * @param {string} userId
     * @returns {Array} Ruta IA del usuario o array vacío.
     */
    getCustomRoadmap(userId) {
        const user = this.getUserById(userId);
        if (!user) return [];

        // Primero verificar si ya hay ruta dentro del documento del usuario
        if (user.learningProgress &&
            user.learningProgress.customRoadmap &&
            user.learningProgress.customRoadmap.length > 0) {
            return user.learningProgress.customRoadmap;
        }

        // Fallback: migrar desde la clave suelta antigua
        const legacyKey = `eduquest_roadmap_${userId}`;
        const legacyData = localStorage.getItem(legacyKey);
        if (legacyData) {
            try {
                const parsed = JSON.parse(legacyData);
                if (parsed.length > 0) {
                    // Migrar al nuevo formato
                    this.saveCustomRoadmap(userId, parsed);
                    return parsed;
                }
            } catch (e) {
                console.error('[UserManager] Error migrando roadmap legacy:', e);
            }
        }

        return [];
    },

    // ─── Diagnóstico ────────────────────────────────────────────────

    /**
     * Guarda los resultados del examen diagnóstico.
     * @param {string} userId
     * @param {Array} results - Array de { topicId, isCorrect }.
     */
    saveDiagnosticResults(userId, results) {
        const users = this.getAllUsers();
        const idx = users.findIndex(u => u.id === userId);
        if (idx === -1) return;

        if (!users[idx].learningProgress) {
            users[idx].learningProgress = {
                lastAccessedCourse: null,
                lastAccessedTopic: null,
                completedTopics: [],
                diagnosticResults: [],
                hardestCourse: null,
                customRoadmap: []
            };
        }

        users[idx].learningProgress.diagnosticResults = results;
        this.saveAllUsers(users);
    },

    // ─── Migración de Esquema ───────────────────────────────────────

    /**
     * Migra usuarios con estructura plana (v1) a la nueva estructura anidada (v2).
     * Se ejecuta automáticamente al iniciar la app.
     * Es idempotente: si el usuario ya tiene `profile`, no se re-migra.
     */
    migrateUsersToNewSchema() {
        const users = this.getAllUsers();
        let migrated = false;

        users.forEach(user => {
            // Si ya tiene `profile`, asumimos que ya está migrado
            if (user.profile) return;

            migrated = true;
            console.log(`[UserManager] Migrando usuario ${user.id} al nuevo esquema...`);

            // Construir profile
            user.profile = {
                avatar: user.avatar || '👤',
                target: user.target || null,
                career: user.career || null
            };

            // Construir stats (solo para estudiantes)
            if (user.role === 'student') {
                user.stats = {
                    totalXp: user.totalXp || 0,
                    streakDays: user.streakDays || 0,
                    rankingPos: user.rankingPos || 'Nuevo Alumno'
                };

                user.learningProgress = {
                    lastAccessedCourse: null,
                    lastAccessedTopic: null,
                    completedTopics: [],
                    diagnosticResults: user.diagnosticResults || [],
                    hardestCourse: user.hardestCourse || null,
                    customRoadmap: []
                };

                // Intentar migrar roadmap desde la clave suelta
                const legacyRoadmap = localStorage.getItem(`eduquest_roadmap_${user.id}`);
                if (legacyRoadmap) {
                    try {
                        user.learningProgress.customRoadmap = JSON.parse(legacyRoadmap);
                        localStorage.removeItem(`eduquest_roadmap_${user.id}`);
                    } catch (e) {
                        console.error(`[UserManager] Error migrando roadmap de ${user.id}:`, e);
                    }
                }
            }

            // Limpiar campos viejos del nivel raíz
            delete user.avatar;
            delete user.target;
            delete user.career;
            delete user.totalXp;
            delete user.streakDays;
            delete user.rankingPos;
            delete user.diagnosticResults;
            delete user.hardestCourse;
        });

        if (migrated) {
            this.saveAllUsers(users);
            console.log('[UserManager] Migración completada.');
        }
    }
};

window.UserManager = UserManager;
