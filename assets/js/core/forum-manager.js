import { supabase } from '../config/supabase.js';

export const ForumManager = {
    async getPublicPosts() {
        try {
            const { data, error } = await supabase
                .from('forum_posts')
                .select(`
                    id,
                    content,
                    tag,
                    upvotes,
                    created_at,
                    profiles (
                        name,
                        target_university
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (error) throw error;
            
            return (data || []).map(post => ({
                id: post.id,
                author: post.profiles?.name || "Usuario Anónimo",
                avatar: "🎓", 
                target: post.profiles?.target_university ? `Meta: ${post.profiles.target_university}` : "Meta: Indefinida",
                tag: post.tag || "General",
                content: post.content,
                upvotes: post.upvotes || 0,
                comments: 0, // TODO: Fetch real comments count
                time: "Reciente" 
            }));
        } catch (error) {
            console.error('[ForumManager] Error fetching public posts:', error);
            return [];
        }
    }
};
