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
    
    // Iniciar el worker de IA si hay tareas pendientes en localStorage
    if (localStorage.getItem('aiQueue')) {
        const queueStr = localStorage.getItem('aiQueue');
        if (queueStr && queueStr !== '[]') {
            console.log('[GlobalWorker] Detectada cola de IA pendiente, inyectando ai-engine.js...');
            if (!window.AIEngine) {
                const script = document.createElement('script');
                script.src = '../../assets/js/core/ai-engine.js';
                script.onload = () => window.AIEngine.processQueue();
                document.body.appendChild(script);
            } else {
                window.AIEngine.processQueue();
            }
        }
    }
});

// Utilidad global de Toast
window.app = window.app || {};
window.app.showToast = function(message, type = 'success') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        toastContainer.style.display = 'flex';
        toastContainer.style.flexDirection = 'column';
        toastContainer.style.gap = '10px';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.style.background = type === 'success' ? '#1D9E75' : '#111827';
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.3s ease';
    toast.innerText = message;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
};

document.addEventListener('click', () => {
    const session = Storage.getSession();
    if (session) {
        session.expiresAt = Date.now() + (60 * 60 * 1000);
        Storage.saveSession(session);
    }
});