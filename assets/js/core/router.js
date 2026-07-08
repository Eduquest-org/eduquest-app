/**
 * @fileoverview Enrutador Frontend Ligero para Aplicación de Página Única (SPA).
 * Gestiona la navegación sin recargas interceptando enlaces y mutando el DOM.
 * 
 * Flujo de ejecución:
 * 1. Escucha eventos globales en elementos con atributo `data-page`.
 * 2. Ejecuta limpieza de memoria y event listeners de la vista actual (`window.cleanup()`).
 * 3. Obtiene el contenido HTML de la nueva vista vía Fetch API.
 * 4. Reemplaza el DOM activo y carga scripts específicos asociados a la ruta.
 */
const Router = {
    async init() {
        const path = window.location.pathname;
        
        if (path.includes('/auth/')) {
            const hasSession = await Auth.checkSession(false);
            if (hasSession && !path.includes('onboarding.html')) {
                const session = Auth.getCurrentUser();
                if (session) {
                    window.location.href = session.role === 'student' ? '../student/dashboard.html' : '../teacher/dashboard.html';
                }
            }
            return;
        }

        if (path.includes('/public/') || path.endsWith('index.html') || path === '/') {
            return;
        }

        await Auth.requireAuth();

        if (path.includes('/student/')) {
            Auth.requireRole('student');
        } else if (path.includes('/teacher/')) {
            Auth.requireRole('teacher');
        }
    }
};