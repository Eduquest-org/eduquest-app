import { supabase } from '../config/supabase.js';

export const ProblemsManager = {
    async getProblemsByTopic(topicId, difficulty = null, limit = null) {
        try {
            let query = supabase
                .from('problems')
                .select('*')
                .eq('topic_id', topicId);
            
            if (difficulty) {
                query = query.eq('difficulty', difficulty);
            }
            if (limit) {
                query = query.limit(limit);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error(`[ProblemsManager] Error fetching problems for topic ${topicId}:`, error);
            return [];
        }
    },
    
    async getAllProblems() {
        try {
            const { data, error } = await supabase
                .from('problems')
                .select('*');
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[ProblemsManager] Error fetching all problems:', error);
            return [];
        }
    }
};
