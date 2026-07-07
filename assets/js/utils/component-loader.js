// ==========================================================================
// assets/js/utils/component-loader.js
// CARGADOR GLOBAL DE COMPONENTES MODULARES 
// ==========================================================================

async function loadComponent(containerId, path) {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        const response = await fetch(path);
        const html = await response.text();
        container.innerHTML = html;
        // GlobalLoader solo existe en páginas que cargan global-loader.js
        // (p. ej. estudiante). En el panel docente no está, así que lo
        // invocamos de forma defensiva para no romper la carga del componente.
        if (typeof GlobalLoader !== 'undefined') GlobalLoader.hide(500);
        return true;
    } catch (error) {
        console.error(`Error crítico cargando el componente [${containerId}]:`, error);
        return false;
    }
}

function activateSidebarCurrentPage() {
    const currentPath = window.location.pathname;
    let currentPage = currentPath.substring(currentPath.lastIndexOf('/') + 1);
    
    if (currentPage === "" || currentPage === "index.html") {
        currentPage = "dashboard.html";
    }

    const sidebarItems = document.querySelectorAll('.sidebar .sb-item, .sb-nav .sb-item');
    
    if (sidebarItems.length === 0) {
        setTimeout(activateSidebarCurrentPage, 30);
        return;
    }

    sidebarItems.forEach(item => {
        const targetPage = item.getAttribute('data-page');

        if (currentPage === targetPage) {
            item.classList.add('on'); 
        } else {
            item.classList.remove('on');
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const fetchPromises = [];

    const topbarContainer = document.getElementById("topbar-container");
    if (topbarContainer) {
        const path = topbarContainer.getAttribute("data-path");
        fetchPromises.push(loadComponent("topbar-container", path));
    }

    const sidebarContainer = document.getElementById("sidebar-container");
    if (sidebarContainer) {
        const path = sidebarContainer.getAttribute("data-path");
        fetchPromises.push(loadComponent("sidebar-container", path));
    }

    const navbarContainer = document.getElementById("navbar-container");
    if (navbarContainer) {
        const path = navbarContainer.getAttribute("data-path");
        fetchPromises.push(loadComponent("navbar-container", path));
    }

    await Promise.all(fetchPromises);

    activateSidebarCurrentPage();

    if (window.UserBindingManager) {
        UserBindingManager.bindAll();
    }

    // Inicializar comportamiento mobile del sidebar
    initMobileSidebarBehavior();

    const preloader = document.getElementById("app-preloader");
    if (preloader) {
        setTimeout(() => {
            preloader.classList.add("fade-out-loader");
            setTimeout(() => preloader.remove(), 400);
        }, 100);
    }
});

/* ====================================================================
   SIDEBAR MOBILE — Abrir/Cerrar con overlay
   ==================================================================== */
function initMobileSidebarBehavior() {
    // Asegurarse de que el overlay existe en el DOM
    let overlay = document.getElementById('sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.id = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }
    overlay.addEventListener('click', closeMobileSidebar);

    // Cerrar sidebar al presionar Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMobileSidebar();
            const panel = document.getElementById('notifications-panel');
            if (panel) panel.classList.remove('show');
        }
    });

    // Cerrar panel de notificaciones al hacer click fuera
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('notifications-panel');
        const wrapper = document.getElementById('notifications-wrapper');
        if (panel && panel.classList.contains('show') && wrapper && !wrapper.contains(e.target)) {
            panel.classList.remove('show');
        }
    });
}

/* Exponer globalmente */
window.toggleMobileSidebar = function() {
    const sidebar = document.getElementById('sidebar-container');
    const overlay = document.getElementById('sidebar-overlay');
    const menuBtn = document.getElementById('mobile-menu-toggle');

    if (!sidebar) return;

    const isOpen = sidebar.classList.contains('active');

    if (isOpen) {
        closeMobileSidebar();
    } else {
        sidebar.classList.add('active');
        if (overlay) overlay.classList.add('visible');
        if (menuBtn) menuBtn.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
};

window.closeMobileSidebar = function() {
    const sidebar = document.getElementById('sidebar-container');
    const overlay = document.getElementById('sidebar-overlay');
    const menuBtn = document.getElementById('mobile-menu-toggle');

    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('visible');
    if (menuBtn) menuBtn.classList.remove('active');
    document.body.style.overflow = '';
};

/* ====================================================================
   NOTIFICACIONES — Toggle del panel dropdown
   ==================================================================== */
window.toggleNotificationsPanel = function() {
    const panel = document.getElementById('notifications-panel');
    if (!panel) return;

    const isOpen = panel.classList.contains('show');

    // Cerrar sidebar si está abierto en mobile
    if (!isOpen) closeMobileSidebar();

    panel.classList.toggle('show', !isOpen);
};

window.markAllNotificationsRead = function() {
    const items = document.querySelectorAll('.notification-item.unread');
    items.forEach(item => item.classList.remove('unread'));

    const badge = document.getElementById('notif-badge');
    if (badge) badge.classList.remove('active');

    if (window.app && window.app.showToast) {
        window.app.showToast('✅ Notificaciones marcadas como leídas', 'success');
    }
};
