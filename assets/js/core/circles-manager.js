/**
 * @fileoverview Capa de datos para Círculos de Estudio.
 * Provee métodos para interactuar con circles_table y circles_table_student en Supabase.
 *
 * Exporta tres managers:
 *  - CirclesManager      → operaciones sobre los círculos (crear, leer)
 *  - UserCirclesManager  → operaciones sobre la membresía de un alumno
 *  - SubjectManager      → consultas sobre la tabla courses
 */

const supabase = window.supabase;

// ============================================================
// CirclesManager — CRUD sobre circles_table
// ============================================================

const CirclesManager = {

    /**
     * Obtiene un círculo por su ID.
     * @param {string} circleId - UUID del círculo.
     * @returns {Object|null}
     */
    async getCircleById(circleId) {
        const { data, error } = await supabase
            .from('circles_table')
            .select('*')
            .eq('id', circleId)
            .single();
        if (error) {
            console.error('CirclesManager.getCircleById: error', error);
            return null;
        }
        return data;
    },

    /**
     * Obtiene todos los círculos públicos.
     * @returns {Array|null}
     */
    async getAllCircles() {
        const { data, error } = await supabase
            .from('circles_table')
            .select('*')
            .eq('is_public', true)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('CirclesManager.getAllCircles: error', error);
            return null;
        }
        return data;
    },

    /**
     * Obtiene círculos filtrados por materia (id_theme).
     * @param {string} themeId - ID del curso (ej. 'course_algebra').
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
            console.error('CirclesManager.getCirclesByTheme: error', error);
            return null;
        }
        return data;
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
            console.error('CirclesManager.getCirclesByOwnerAndName: error', error);
            return null;
        }
        return data;
    },

    /**
     * Crea un círculo nuevo y registra al creador como admin.
     * @param {string} circleName
     * @param {string} circleDescription
     * @param {string} circleTheme  - ID de curso (ej. 'course_algebra')
     * @param {string} circleOwner - UUID del usuario creador
     * @returns {Object|null} El círculo creado.
     */
    async createCircle(circleName, circleDescription, circleTheme, circleOwner) {
        const { data, error } = await supabase
            .from('circles_table')
            .insert([{
                name: circleName,
                description: circleDescription,
                id_theme: circleTheme,
                id_owner: circleOwner,
                is_public: true
            }])
            .select()
            .single();

        if (error) {
            console.error('CirclesManager.createCircle: error al insertar círculo', error);
            return null;
        }

        // Registrar al creador como admin de su propio círculo
        const memberError = await UserCirclesManager.createConectionCircleStudent('admin', data.id, circleOwner);
        if (!memberError) {
            console.warn('CirclesManager.createCircle: círculo creado pero no se pudo registrar al dueño como admin');
        }

        return data;
    },
};

// ============================================================
// UserCirclesManager — membresía de un alumno en circles_table_student
// ============================================================

const UserCirclesManager = {

    /**
     * Obtiene todos los círculos a los que pertenece un usuario.
     * @param {string} userId - UUID del estudiante.
     * @returns {Array|null}
     */
    async getCirclesByUserId(userId) {
        const { data, error } = await supabase
            .from('circles_table_student')
            .select('*')
            .eq('id_student', userId);
        if (error) {
            console.error('UserCirclesManager.getCirclesByUserId: error', error);
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
        if (error) {
            console.error('UserCirclesManager.checkMembership: error', error);
            return false;
        }
        return !!data;
    },

    /**
     * Une a un estudiante a un círculo.
     * @param {string} circleRole - 'member' | 'admin'
     * @param {string} circleId
     * @param {string} studentId
     * @returns {Object|null} Registro creado.
     */
    async createConectionCircleStudent(circleRole, circleId, studentId) {
        const { data, error } = await supabase
            .from('circles_table_student')
            .insert([{
                id_circle: circleId,
                id_student: studentId,
                role: circleRole
            }])
            .select()
            .single();
        if (error) {
            console.error('UserCirclesManager.createConectionCircleStudent: error', error);
            return null;
        }
        return data;
    },

    /**
     * Saca a un estudiante de un círculo.
     * @param {string} circleId
     * @param {string} studentId
     * @returns {boolean} true si se eliminó correctamente.
     */
    async leaveCircle(circleId, studentId) {
        const { error } = await supabase
            .from('circles_table_student')
            .delete()
            .eq('id_circle', circleId)
            .eq('id_student', studentId);
        if (error) {
            console.error('UserCirclesManager.leaveCircle: error', error);
            return false;
        }
        return true;
    },

    /**
     * Actualiza el rol de un estudiante dentro de un círculo.
     * @param {string} circleId
     * @param {string} studentId
     * @param {string} circleRole - 'member' | 'admin'
     * @returns {Object|null}
     */
    async updateRoleCircleStudent(circleId, studentId, circleRole) {
        const { data, error } = await supabase
            .from('circles_table_student')
            .update({ role: circleRole })   // update va ANTES de los filtros
            .eq('id_student', studentId)
            .eq('id_circle', circleId)
            .select()
            .single();
        if (error) {
            console.error('UserCirclesManager.updateRoleCircleStudent: error', error);
            return null;
        }
        return data;
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
            .eq('id', subjectId)   // .eq() va DESPUÉS de .select()
            .maybeSingle();
        if (error) {
            console.error('SubjectManager.getSubjectById: error', error);
            return null;
        }
        return data;
    },

    /**
     * Obtiene todos los cursos disponibles.
     * @returns {Array|null}
     */
    async getAllSubjects() {
        const { data, error } = await supabase
            .from('courses')
            .select('*')
            .order('name', { ascending: true });
        if (error) {
            console.error('SubjectManager.getAllSubjects: error', error);
            return null;
        }
        return data;
    },
};

export { CirclesManager, UserCirclesManager, SubjectManager };