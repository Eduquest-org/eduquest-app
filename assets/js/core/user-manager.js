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

    async updateStreak(userId) {
        const user = await this.getUserById(userId);
        if (!user) return;

        const now = new Date();
        const lastSolvedStr = user.last_problem_solved_at;

        let newStreak = user.streak_days || 0;

        if (lastSolvedStr) {
            const lastSolved = new Date(lastSolvedStr);
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const lastDate = new Date(lastSolved.getFullYear(), lastSolved.getMonth(), lastSolved.getDate());

            const diffTime = today - lastDate;
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                newStreak += 1;
            } else if (diffDays > 1) {
                newStreak = 1;
            }
        } else {
            newStreak = 1;
        }

        const updates = {
            streak_days: newStreak,
            last_problem_solved_at: now.toISOString()
        };

        await this.updateStats(userId, updates);

        if (window.CurrentUserService) {
            const profile = window.CurrentUserService.getProfile();
            if (profile && profile.id === userId) {
                profile.streak_days = newStreak;
                profile.last_problem_solved_at = updates.last_problem_solved_at;
                if (window.UserBindingManager) window.UserBindingManager.bindAll();
            }
        }
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

    async saveUserTopicStats(userId, topicId, correctCount, incorrectCount) {
        if (!userId || !topicId) {
            console.error('[UserManager] saveUserTopicStats ignorado por falta de parámetros:', { userId, topicId });
            return;
        }
        
        try {
            console.log(`[UserManager] Iniciando guardado de stats para usuario=${userId}, topic=${topicId}`);
            
            // First, fetch existing stats for this topic
            const { data: existingStats, error: fetchError } = await supabase
                .from('user_topic_stats')
                .select('*')
                .eq('user_id', userId)
                .eq('topic_id', topicId)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "No rows found"
                console.error('[UserManager] Error fetching user_topic_stats:', fetchError);
            }

            const now = new Date().toISOString();

            let newAttempts = 1;
            let newCorrect = correctCount;
            let newIncorrect = incorrectCount;

            if (existingStats) {
                console.log(`[UserManager] Datos previos encontrados para topic=${topicId}. Sumando valores...`);
                newAttempts = (existingStats.total_attempts || 0) + 1;
                newCorrect = (existingStats.correct_answers || 0) + correctCount;
                newIncorrect = (existingStats.incorrect_answers || 0) + incorrectCount;
            } else {
                console.log(`[UserManager] No hay datos previos para topic=${topicId}. Creando nuevo registro...`);
            }

            // Realizamos upsert aprovechando el constraint unique_user_topic
            const { error: upsertError } = await supabase
                .from('user_topic_stats')
                .upsert({
                    user_id: userId,
                    topic_id: topicId,
                    total_attempts: newAttempts,
                    correct_answers: newCorrect,
                    incorrect_answers: newIncorrect,
                    last_practiced_at: now
                }, {
                    onConflict: 'user_id, topic_id'
                });

            if (upsertError) {
                console.error('[UserManager] Error guardando user_topic_stats (Upsert):', upsertError);
            } else {
                console.log(`[UserManager] Guardado (Upsert) exitoso para topic=${topicId}`);
            }
        } catch (error) {
            console.error('[UserManager] Unexpected error in saveUserTopicStats:', error);
        }
    },

    async getAllUserTopicStats(userId) {
        const { data, error } = await supabase
            .from('user_topic_stats')
            .select('*')
            .eq('user_id', userId);
        
        if (error) {
            console.error('Error fetching all user_topic_stats:', error);
            return [];
        }
        return data || [];
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
