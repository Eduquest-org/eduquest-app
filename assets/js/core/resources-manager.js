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
    }
};

