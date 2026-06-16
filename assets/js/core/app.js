const SessionManager = {
    async init() {
        await Auth.initDB();
        Router.init();
        
        if (window.UserBindingManager) {
            UserBindingManager.bindAll();
        }

        setInterval(() => {
            const path = window.location.pathname;
            if (!path.includes('/auth/') && !path.includes('/public/') && path !== '/' && !path.endsWith('index.html')) {
                Auth.checkSession(true);
            }
        }, 60000); 
    }
};

document.addEventListener('DOMContentLoaded', () => {
    SessionManager.init();
});

document.addEventListener('click', () => {
    const session = Storage.getSession();
    if (session) {
        session.expiresAt = Date.now() + (60 * 60 * 1000);
        Storage.saveSession(session);
    }
});