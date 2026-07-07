import { supabase } from '../config/supabase.js';

export const TopicsManager = {
    async getAllTopics() {
        try {
            const { data, error } = await supabase
                .from('topics')
                .select('*')
                .order('name');
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[TopicsManager] Error fetching all topics:', error);
            return [];
        }
    },

    async getTopicsByCourse(courseId) {
        try {
            const { data, error } = await supabase
                .from('topics')
                .select('*')
                .eq('course_id', courseId)
                .order('name');
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error(`[TopicsManager] Error fetching topics for course ${courseId}:`, error);
            return [];
        }
    }
};
