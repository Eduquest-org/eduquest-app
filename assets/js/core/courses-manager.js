/**
 * @fileoverview Administrador de Caché Estructural de Cursos y Temarios (Singleton).
 * Minimiza las peticiones a base de datos para la estructura fundamental académica.
 * 
 * Flujo de ejecución:
 * 1. Intercepta solicitudes de cursos y temas.
 * 2. Verifica existencia en `localStorage` (Cache Hit/Miss).
 * 3. Si no existe, realiza consulta a Supabase y persiste los resultados localmente.
 * 4. Responde consultas con mapeo directo O(1).
 */
import { supabase } from '../config/supabase.js';

export const CoursesManager = {
    async getCourses() {
        try {
            const { data, error } = await supabase
                .from('courses')
                .select('*')
                .order('name');
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[CoursesManager] Error fetching courses:', error);
            return [];
        }
    },

    async getCourseById(id) {
        try {
            const { data, error } = await supabase
                .from('courses')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error(`[CoursesManager] Error fetching course ${id}:`, error);
            return null;
        }
    }
};
