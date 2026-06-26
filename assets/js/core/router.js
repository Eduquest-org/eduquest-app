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