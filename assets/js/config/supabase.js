/**
 * @fileoverview Cliente de Conexión a Base de Datos y Autenticación.
 * Instancia y expone el SDK de Supabase de manera global.
 * 
 * Flujo de ejecución:
 * 1. Inyección de variables de entorno (URL y ANON_KEY).
 * 2. Configuración del cliente `supabase` con políticas de seguridad de nivel de fila (RLS).
 * 3. Exposición global vía `window.supabase` para el acceso de los módulos funcionales.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://gjxtbrouqekdvogisequ.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqeHRicm91cWVrZHZvZ2lzZXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNDM3MzUsImV4cCI6MjA5NzkxOTczNX0.b8jhrTOXu2tyR-UHNDrj4lWBce1vuvmH4bLRRPxVyqM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabase;

// ─── Helpers de Storage ──────────────────────────────────────

/**
 * Sube un avatar al bucket "avatars" y devuelve la URL pública.
 * La imagen se guarda en: avatars/{userId}/{filename}
 */
export async function uploadAvatar(userId, file) {
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/avatar.${fileExt}`;

    const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

    if (error) throw error;

    const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

    return urlData.publicUrl;
}

/**
 * Sube una imagen al bucket "forum_media" y devuelve la URL pública.
 * La imagen se guarda en: forum_media/{userId}/{timestamp}_{filename}
 */
export async function uploadForumImage(userId, file) {
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${timestamp}_post.${fileExt}`;

    const { data, error } = await supabase.storage
        .from('forum_media')
        .upload(filePath, file);

    if (error) throw error;

    const { data: urlData } = supabase.storage
        .from('forum_media')
        .getPublicUrl(filePath);

    return urlData.publicUrl;
}

// ─── Helpers de Auth ─────────────────────────────────────────

/**
 * Registra un nuevo usuario con email y contraseña.
 * Los metadatos (name, role) se pasan como user_metadata
 * para que el trigger de Postgres los use al crear el profile.
 */
export async function signUp({ email, password, name, role = 'student' }) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { name, role }
        }
    });
    if (error) throw error;
    return data;
}

/**
 * Inicia sesión con email y contraseña.
 */
export async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) throw error;
    return data;
}

/**
 * Cierra la sesión actual.
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

/**
 * Devuelve el usuario autenticado actual (o null).
 */
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

/**
 * Listener de cambios de sesión.
 * Ejemplo de uso:
 *   onAuthChange((event, session) => {
 *     if (event === 'SIGNED_IN') { ... }
 *   });
 */
export function onAuthChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
}
