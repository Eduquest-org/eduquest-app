/**
 * @fileoverview Servicio principal de gestión de usuarios y estado en Supabase.
 * Proporciona métodos para interactuar con la tabla de perfiles, actualizar estadísticas,
 * gestionar el progreso académico y manipular el mapa de aprendizaje generado por la IA.
 * 
 * Este módulo actúa como una capa de abstracción sobre el cliente de Supabase,
 * unificando las operaciones de lectura y escritura de perfiles de usuario.
 */

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
            .update(partialProfile) // Actualizar campos específicos del perfil
            .eq('id', userId);
        if (error) console.error('Error updating profile:', error);
    },

    async updateStats(userId, partialStats) {
        const { error } = await supabase
            .from('profiles')
            .update(partialStats) // Actualizar métricas de progreso
            .eq('id', userId);
        if (error) console.error('Error updating stats:', error);
    },

    async addXp(userId, amount) {
        const user = await this.getUserById(userId);
        if (!user) return 0;

        const newXp = (user.total_xp || 0) + amount;
        await this.updateStats(userId, { total_xp: newXp });

        // Sincronizar el estado local y actualizar la interfaz de usuario
        if (window.CurrentUserService) {
            const profile = window.CurrentUserService.getProfile();
            if (profile && profile.id === userId) {
                profile.total_xp = newXp;
                if (window.UserBindingManager) window.UserBindingManager.bindAll();
            }
        }

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

    /** @deprecated Método preservado temporalmente para asegurar retrocompatibilidad. */
    migrateUsersToNewSchema() {
        console.log('[UserManager] Supabase migration replaces local schema logic.');
    }
};

window.UserManager = UserManager;
