/**
 * @fileoverview Capa de datos para Círculos de Estudio — v2.
 *
 * Exporta cuatro managers:
 *  - CirclesManager      → CRUD sobre circles_table
 *  - UserCirclesManager  → membresía de un alumno (circles_table_student)
 *  - JoinRequestManager  → solicitudes para círculos privados (circle_join_requests)
 *  - SubjectManager      → consultas sobre la tabla courses
 */

const supabase = window.supabase;

// ============================================================
// CirclesManager — CRUD sobre circles_table
// ============================================================

const CirclesManager = {

    /**
     * Obtiene un círculo por su UUID.
     * @param {string} circleId
     * @returns {Object|null}
     */
    async getCircleById(circleId) {
        const { data, error } = await supabase
            .from('circles_table')
            .select('*')
            .eq('id', circleId)
            .single();
        if (error) {
            console.error('CirclesManager.getCircleById:', error.message);
            return null;
        }
        return data;
    },

    /**
     * Busca un círculo por su join_code (6 chars, mayúsculas).
     * Retorna tanto círculos públicos como privados para poder mostrar info
     * antes de que el usuario decida unirse.
     * @param {string} code - Ej: 'ALG4K2'
     * @returns {Object|null}
     */
    async getCircleByCode(code) {
        const { data, error } = await supabase
            .from('circles_table')
            .select('*')
            .eq('join_code', code.trim().toUpperCase())
            .maybeSingle();
        if (error) {
            console.error('CirclesManager.getCircleByCode:', error.message);
            return null;
        }
        return data; // null si no existe
    },

    /**
     * Obtiene todos los círculos públicos ordenados por fecha de creación.
     * @returns {Array|null}
     */
    async getAllCircles() {
        const { data, error } = await supabase
            .from('circles_table')
            .select('*')
            .eq('is_public', true)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('CirclesManager.getAllCircles:', error.message);
            return null;
        }
        return data;
    },

    /**
     * Obtiene círculos filtrados por materia principal (id_theme).
     * @param {string} themeId - ej. 'course_algebra'
     * @returns {Array|null}
     */
    async getCirclesByTheme(themeId) {
        const { data, error } = await supabase
            .from('circles_table')
            .select('*')
            .eq('id_theme', themeId)
            .eq('is_public', true)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('CirclesManager.getCirclesByTheme:', error.message);
            return null;
        }
        return data;
    },

    /**
     * Obtiene los miembros de un círculo con su información de perfil.
     * Hace un JOIN entre circles_table_student y profiles para traer
     * nombre, avatar y rol en una sola consulta.
     * @param {string} circleId
     * @returns {Array|null} Array de { id, id_student, role, joined_at, name, avatar_url }
     */
    async getCircleMembers(circleId) {
        const { data, error } = await supabase
            .from('circles_table_student')
            .select(`
                id,
                id_student,
                role,
                joined_at,
                profiles:id_student ( name, avatar_url, total_xp )
            `)
            .eq('id_circle', circleId)
            .order('joined_at', { ascending: true });
        if (error) {
            console.error('CirclesManager.getCircleMembers:', error.message);
            return null;
        }
        // Aplanar: mover name, avatar_url y total_xp al nivel raíz
        return (data || []).map(m => ({
            id:         m.id,
            id_student: m.id_student,
            role:       m.role,
            joined_at:  m.joined_at,
            name:       m.profiles?.name       || 'Usuario',
            avatar_url: m.profiles?.avatar_url || '👤',
            total_xp:   m.profiles?.total_xp   || 0,
        }));
    },

    /**
     * Busca círculos del mismo dueño con el mismo nombre (para evitar duplicados).
     * @param {string} userId
     * @param {string} name
     * @returns {Array|null}
     */
    async getCirclesByOwnerAndName(userId, name) {
        const { data, error } = await supabase
            .from('circles_table')
            .select('*')
            .eq('id_owner', userId)
            .eq('name', name);
        if (error) {
            console.error('CirclesManager.getCirclesByOwnerAndName:', error.message);
            return null;
        }
        return data;
    },

    /**
     * Crea un círculo nuevo y registra al creador como admin.
     * El join_code se genera automáticamente por el trigger de Supabase.
     * @param {string} circleName
     * @param {string} circleDescription
     * @param {string} circleTheme     - ID de curso (ej. 'course_algebra')
     * @param {string} circleOwner    - UUID del usuario creador
     * @param {boolean} isPublic      - true = público, false = privado
     * @param {number|null} maxMembers - Límite de miembros (opcional)
     * @returns {Object|null} El círculo creado con su join_code.
     */
    async createCircle(circleName, circleDescription, circleTheme, circleOwner, isPublic = true, maxMembers = null) {
        const { data, error } = await supabase
            .from('circles_table')
            .insert([{
                name:        circleName,
                description: circleDescription,
                id_theme:    circleTheme,
                id_owner:    circleOwner,
                is_public:   isPublic,
                max_members: maxMembers,
            }])
            .select()
            .single();

        if (error) {
            console.error('CirclesManager.createCircle:', error.message);
            return null;
        }

        // Registrar al creador como admin de su propio círculo
        await UserCirclesManager.createConectionCircleStudent('admin', data.id, circleOwner);
        return data;
    },

    /**
     * Actualiza la descripción de un círculo
     * @param {string} circleId 
     * @param {string} description 
     * @returns {boolean}
     */
    async updateCircleDesc(circleId, description) {
        const { error } = await supabase
            .from('circles_table')
            .update({ description })
            .eq('id', circleId);
        if (error) {
            console.error('CirclesManager.updateCircleDesc:', error.message);
            return false;
        }
        return true;
    }
};

// ============================================================
// UserCirclesManager — membresía en circles_table_student
// ============================================================

const UserCirclesManager = {

    /**
     * Obtiene todos los círculos a los que pertenece un usuario.
     * @param {string} userId
     * @returns {Array|null}
     */
    async getCirclesByUserId(userId) {
        const { data, error } = await supabase
            .from('circles_table_student')
            .select('*')
            .eq('id_student', userId);
        if (error) {
            console.error('UserCirclesManager.getCirclesByUserId:', error.message);
            return null;
        }
        return data;
    },

    /**
     * Verifica si un usuario ya es miembro de un círculo específico.
     * @param {string} circleId
     * @param {string} userId
     * @returns {boolean}
     */
    async checkMembership(circleId, userId) {
        const { data, error } = await supabase
            .from('circles_table_student')
            .select('id')
            .eq('id_circle', circleId)
            .eq('id_student', userId)
            .maybeSingle();
        if (error) return false;
        return !!data;
    },

    /**
     * Obtiene el rol de un usuario en un círculo ('admin' | 'member' | null).
     * @param {string} circleId
     * @param {string} userId
     * @returns {'admin'|'member'|null}
     */
    async getUserRole(circleId, userId) {
        const { data, error } = await supabase
            .from('circles_table_student')
            .select('role')
            .eq('id_circle', circleId)
            .eq('id_student', userId)
            .maybeSingle();
        if (error || !data) return null;
        return data.role;
    },

    /**
     * Une a un estudiante a un círculo.
     * @param {'admin'|'member'} circleRole
     * @param {string} circleId
     * @param {string} studentId
     * @returns {Object|null}
     */
    async createConectionCircleStudent(circleRole, circleId, studentId) {
        const { data, error } = await supabase
            .from('circles_table_student')
            .insert([{
                id_circle:  circleId,
                id_student: studentId,
                role:       circleRole,
            }])
            .select()
            .single();
        if (error) {
            console.error('UserCirclesManager.createConectionCircleStudent:', error.message);
            return null;
        }
        return data;
    },

    /**
     * Saca a un estudiante de un círculo.
     * El trigger de Supabase actualiza number_students automáticamente.
     * @param {string} circleId
     * @param {string} studentId
     * @returns {boolean}
     */
    async leaveCircle(circleId, studentId) {
        const { error } = await supabase
            .from('circles_table_student')
            .delete()
            .eq('id_circle', circleId)
            .eq('id_student', studentId);
        if (error) {
            console.error('UserCirclesManager.leaveCircle:', error.message);
            return false;
        }
        return true;
    },

    /**
     * Actualiza el rol de un estudiante dentro de un círculo.
     * Solo el admin del círculo debería llamar a este método.
     * @param {string} circleId
     * @param {string} studentId
     * @param {'admin'|'member'} circleRole
     * @returns {Object|null}
     */
    async updateRoleCircleStudent(circleId, studentId, circleRole) {
        const { data, error } = await supabase
            .from('circles_table_student')
            .update({ role: circleRole })
            .eq('id_student', studentId)
            .eq('id_circle', circleId)
            .select()
            .single();
        if (error) {
            console.error('UserCirclesManager.updateRoleCircleStudent:', error.message);
            return null;
        }
        return data;
    },
};

// ============================================================
// JoinRequestManager — solicitudes para círculos privados
// ============================================================

const JoinRequestManager = {

    /**
     * Envía una solicitud para unirse a un círculo privado.
     * @param {string} circleId
     * @param {string} studentId
     * @param {string} message - Mensaje opcional del solicitante
     * @returns {Object|null} La solicitud creada.
     */
    async sendRequest(circleId, studentId, message = '') {
        const { data, error } = await supabase
            .from('circle_join_requests')
            .insert([{
                id_circle:  circleId,
                id_student: studentId,
                message:    message.trim() || null,
                status:     'pending',
            }])
            .select()
            .single();
        if (error) {
            console.error('JoinRequestManager.sendRequest:', error.message);
            return null;
        }
        return data; // El trigger notifica al admin automáticamente
    },

    /**
     * Verifica si un alumno ya tiene una solicitud pendiente para un círculo.
     * @param {string} circleId
     * @param {string} studentId
     * @returns {'pending'|'approved'|'rejected'|null} Estado de la solicitud o null si no existe.
     */
    async checkRequest(circleId, studentId) {
        const { data, error } = await supabase
            .from('circle_join_requests')
            .select('status')
            .eq('id_circle', circleId)
            .eq('id_student', studentId)
            .maybeSingle();
        if (error || !data) return null;
        return data.status;
    },

    /**
     * Obtiene todas las solicitudes pendientes de un círculo (para el admin).
     * Incluye datos del perfil del solicitante (nombre, avatar).
     * @param {string} circleId
     * @returns {Array|null} Array de { id, id_student, message, created_at, name, avatar_url }
     */
    async getPendingRequests(circleId) {
        const { data, error } = await supabase
            .from('circle_join_requests')
            .select(`
                id,
                id_student,
                message,
                created_at,
                profiles:id_student ( name, avatar_url )
            `)
            .eq('id_circle', circleId)
            .eq('status', 'pending')
            .order('created_at', { ascending: true });
        if (error) {
            console.error('JoinRequestManager.getPendingRequests:', error.message);
            return null;
        }
        // Aplanar perfil al nivel raíz
        return (data || []).map(r => ({
            id:         r.id,
            id_student: r.id_student,
            message:    r.message,
            created_at: r.created_at,
            name:       r.profiles?.name       || 'Usuario',
            avatar_url: r.profiles?.avatar_url || '👤',
        }));
    },

    /**
     * Aprueba una solicitud de unión (solo admins).
     * El trigger de Supabase:
     *   1. Inserta al alumno en circles_table_student automáticamente.
     *   2. Notifica al alumno vía tabla notifications.
     * @param {string} requestId - UUID de la solicitud
     * @returns {boolean}
     */
    async approveRequest(requestId) {
        const { error } = await supabase
            .from('circle_join_requests')
            .update({ status: 'approved' })
            .eq('id', requestId);
        if (error) {
            console.error('JoinRequestManager.approveRequest:', error.message);
            return false;
        }
        return true;
    },

    /**
     * Rechaza una solicitud de unión (solo admins).
     * El trigger notifica al alumno automáticamente.
     * @param {string} requestId - UUID de la solicitud
     * @returns {boolean}
     */
    async rejectRequest(requestId) {
        const { error } = await supabase
            .from('circle_join_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId);
        if (error) {
            console.error('JoinRequestManager.rejectRequest:', error.message);
            return false;
        }
        return true;
    },
};

// ============================================================
// SubjectManager — consultas sobre courses
// ============================================================

const SubjectManager = {

    /**
     * Obtiene un curso por su ID.
     * @param {string} subjectId - ej. 'course_algebra'
     * @returns {Object|null}
     */
    async getSubjectById(subjectId) {
        const { data, error } = await supabase
            .from('courses')
            .select()
            .eq('id', subjectId)
            .maybeSingle();
        if (error) {
            console.error('SubjectManager.getSubjectById:', error.message);
            return null;
        }
        return data;
    },

    /**
     * Obtiene todos los cursos disponibles ordenados alfabéticamente.
     * @returns {Array|null}
     */
    async getAllSubjects() {
        const { data, error } = await supabase
            .from('courses')
            .select('*')
            .order('name', { ascending: true });
        if (error) {
            console.error('SubjectManager.getAllSubjects:', error.message);
            return null;
        }
        return data;
    },
};

export { CirclesManager, UserCirclesManager, JoinRequestManager, SubjectManager };