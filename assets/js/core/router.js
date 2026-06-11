const Router = {
    init() {
        const path = window.location.pathname;
        
        if (path.includes('/auth/')) {
            if (Auth.checkSession(false)) {
                const session = Auth.getCurrentUser();
                window.location.href = session.role === 'student' ? '../student/dashboard.html' : '../teacher/dashboard.html';
            }
            return;
        }

        if (path.includes('/public/') || path.endsWith('index.html') || path === '/') {
            return;
        }

        Auth.requireAuth();

        if (path.includes('/student/')) {
            Auth.requireRole('student');
        } else if (path.includes('/teacher/')) {
            Auth.requireRole('teacher');
        }
    }
};