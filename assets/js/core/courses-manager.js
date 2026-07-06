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
