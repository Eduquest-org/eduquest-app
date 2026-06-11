const SessionManager = {
    async init() {
        await Auth.initDB();
        Router.init();
        
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