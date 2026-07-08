import { supabase } from '../config/supabase.js';

const PAGE_SIZE = 15;

export const ResourcesManager = {

    /**
     * Obtiene recursos paginados con filtros opcionales.
     * @param {Object} opts - { page, search, filterType, courseId }
     * @returns {Promise<{ data: Array, totalCount: number }>}
     */
    async getResources({ page = 1, search = '', filterType = 'todos', courseId = null } = {}) {
        const from = (page - 1) * PAGE_SIZE;
        const to   = from + PAGE_SIZE - 1;

        let query = supabase
            .from('resources')
            .select(`
                id, type, title, url, description,
                courses ( id, name, color, icon, category ),
                topics  ( id, name )
            `, { count: 'exact' })
            .range(from, to)
            .order('title', { ascending: true });

        // Filtro de tipo
        if (filterType && filterType !== 'todos') {
            if (filterType === 'evaluacion') {
                query = query.in('type', ['quiz', 'examen', 'desafio_final']);
            } else {
                query = query.eq('type', filterType);
            }
        }

        // Filtro de curso
        if (courseId) {
            query = query.eq('course_id', courseId);
        }

        // Búsqueda por título
        if (search && search.trim() !== '') {
            query = query.ilike('title', `%${search.trim()}%`);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        return { data: data || [], totalCount: count || 0 };
    },

    /**
     * Conteos globales por tipo (query ligera, solo campo type).
     */
    async getStatsCounts() {
        const { data, error } = await supabase
            .from('resources')
            .select('type');

        if (error) return { videos: 0, lecturas: 0, evaluaciones: 0, total: 0 };

        const all = data || [];
        return {
            videos:       all.filter(r => r.type === 'leccion').length,
            lecturas:     all.filter(r => r.type === 'recurso').length,
            evaluaciones: all.filter(r => ['quiz','examen','desafio_final'].includes(r.type)).length,
            total:        all.length
        };
    },

    /**
     * Listado completo de recursos para el panel docente (sin paginación
     * agresiva; el catálogo es pequeño). Soporta búsqueda, filtro exacto de
     * tipo y filtro de curso.
     * @param {Object} opts - { search, type, courseId }
     */
    async getResourcesForTeacher({ search = '', type = 'todos', courseId = null } = {}) {
        let query = supabase
            .from('resources')
            .select(`
                id, type, title, url, description, course_id, topic_id,
                courses ( id, name, color, icon ),
                topics  ( id, name )
            `)
            .order('title', { ascending: true });

        if (type && type !== 'todos') {
            query = query.eq('type', type);
        }
        if (courseId) {
            query = query.eq('course_id', courseId);
        }
        if (search && search.trim() !== '') {
            query = query.ilike('title', `%${search.trim()}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    /**
     * Conteos específicos para el panel docente: PDFs (recursos alojados en
     * el bucket eduquest-docs), videos, lecturas totales y evaluaciones.
     */
    async getTeacherStatsCounts() {
        const { data, error } = await supabase
            .from('resources')
            .select('type, url');

        if (error) return { pdfs: 0, videos: 0, readings: 0, total: 0 };

        const all = data || [];
        return {
            pdfs:     all.filter(r => r.type === 'recurso' && (r.url || '').includes('/eduquest-docs/')).length,
            videos:   all.filter(r => r.type === 'leccion').length,
            readings: all.filter(r => r.type === 'recurso').length,
            total:    all.length
        };
    },

    /** Genera un id único legible para un nuevo recurso. */
    generateResourceId(type) {
        const prefix = { leccion: 'lec', recurso: 'rec', quiz: 'quiz', examen: 'exa', desafio_final: 'des' }[type] || 'res';
        return `res_${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    },

    /** Crea un nuevo recurso en el catálogo. */
    async createResource({ title, type, courseId, topicId, url, description }) {
        const id = this.generateResourceId(type);
        const { data, error } = await supabase
            .from('resources')
            .insert({
                id,
                title,
                type,
                course_id: courseId,
                topic_id: topicId,
                url: url || null,
                description: description || null,
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    /** Actualiza un recurso existente. */
    async updateResource(id, { title, type, courseId, topicId, url, description }) {
        const { data, error } = await supabase
            .from('resources')
            .update({
                title,
                type,
                course_id: courseId,
                topic_id: topicId,
                url: url || null,
                description: description || null,
            })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    /** Elimina un recurso del catálogo. */
    async deleteResource(id) {
        const { error } = await supabase.from('resources').delete().eq('id', id);
        if (error) throw error;
    },

    /**
     * Sube un archivo PDF al bucket "eduquest-docs" bajo una carpeta dada
     * (normalmente el slug del curso) y devuelve la URL pública.
     */
    async uploadResourcePdf(folder, file) {
        const safeName = String(file.name || 'documento.pdf')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9.]/g, '_')
            .replace(/_+/g, '_')
            .slice(0, 80);
        const path = `${folder}/${Date.now()}_${safeName}`;

        const { error } = await supabase.storage
            .from('eduquest-docs')
            .upload(path, file, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' });
        if (error) throw error;

        const { data } = supabase.storage.from('eduquest-docs').getPublicUrl(path);
        return data.publicUrl;
    },

    /** Elimina un archivo del bucket "eduquest-docs" a partir de su URL pública. */
    async deleteResourcePdfByUrl(url) {
        if (!url || !url.includes('/eduquest-docs/')) return;
        const path = url.split('/eduquest-docs/')[1];
        if (!path) return;
        await supabase.storage.from('eduquest-docs').remove([path]);
    }
};

