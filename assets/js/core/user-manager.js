import { supabase } from '../config/supabase.js';

const UserManager = {
    async getUserById(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) {
            console.error('Error fetching user:', error);
            return null;
        }
        return data;
    },

    async getCurrentUserDoc() {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!session) return null;
        const profile = await this.getUserById(session.user.id);
        return profile;
    },

    async updateProfile(userId, partialProfile) {
        const { error } = await supabase
            .from('profiles')
            .update(partialProfile) // target_university_id, career, etc.
            .eq('id', userId);
        if (error) console.error('Error updating profile:', error);
    },

    async updateStats(userId, partialStats) {
        const { error } = await supabase
            .from('profiles')
            .update(partialStats) // streak_days, total_xp, etc.
            .eq('id', userId);
        if (error) console.error('Error updating stats:', error);
    },

    async addXp(userId, amount) {
        const user = await this.getUserById(userId);
        if (!user) return 0;

        const newXp = (user.total_xp || 0) + amount;
        await this.updateStats(userId, { total_xp: newXp });
        return newXp;
    },

    async completeTopicProgress(userId, topicId, courseId, xpEarned) {
        const { error: progressError } = await supabase
            .from('user_topic_progress')
            .upsert({
                user_id: userId,
                topic_id: topicId,
                status: 'completed',
                last_accessed: new Date().toISOString()
            }, { onConflict: 'user_id, topic_id' });

        if (progressError) {
            console.error('Error saving topic progress:', progressError);
        }

        await this.addXp(userId, xpEarned);
    },

    async saveCustomRoadmap(userId, roadmapData) {
        const { error } = await supabase
            .from('profiles')
            .update({ ai_roadmap: roadmapData })
            .eq('id', userId);
        if (error) console.error('Error saving custom roadmap:', error);
    },

    async getCustomRoadmap(userId) {
        const user = await this.getUserById(userId);
        if (!user) return [];
        return user.ai_roadmap || [];
    },

    async saveDiagnosticResults(userId, results) {
        const { error } = await supabase
            .from('profiles')
            .update({ diagnostic_results: results })
            .eq('id', userId);
        if (error) console.error('Error saving diagnostic results:', error);
    },

    // Método obsoleto mantenido para compatibilidad
    migrateUsersToNewSchema() {
        console.log('[UserManager] Supabase migration replaces local schema logic.');
    }
};

window.UserManager = UserManager;
