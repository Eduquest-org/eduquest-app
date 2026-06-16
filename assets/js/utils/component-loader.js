// ==========================================================================
// assets/js/utils/component-loader.js
// CARGADOR GLOBAL DE COMPONENTES MODULARES 
// ==========================================================================

// assets/js/utils/component-loader.js

async function loadComponent(containerId, path) {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        const response = await fetch(path);
        const html = await response.text();
        container.innerHTML = html;
        GlobalLoader.hide(500); 
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

    const sidebarItems = document.querySelectorAll('.sidebar .sb-item, .sb-nav .sb-item, .sidebar .nav-item');
    
    if (sidebarItems.length === 0) {
        setTimeout(activateSidebarCurrentPage, 30);
        return;
    }

    sidebarItems.forEach(item => {
        const targetPage = item.getAttribute('data-page');

        if (currentPage === targetPage || (currentPage === 'dashboard.html' && targetPage === 'index.html')) {
            item.classList.add('on'); 
            item.classList.add('active'); 
            const dot = item.querySelector('.sb-dot');
            if (dot) dot.classList.add('g'); 
        } else {
            item.classList.remove('on');
            item.classList.remove('active');
        }
    });

    // Control de Sidebar Móvil para panel de profesor
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('backdrop');
    document.getElementById('menuToggle')?.addEventListener('click', ()=>{
      sidebar?.classList.toggle('open');
      backdrop?.classList.toggle('open');
    });
    backdrop?.addEventListener('click', ()=>{
      sidebar?.classList.remove('open');
      backdrop?.classList.remove('open');
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

    const navbarContainer =
        document.getElementById("navbar-container");

    if (navbarContainer) {
        const path =
            navbarContainer.getAttribute("data-path");

        fetchPromises.push(
            loadComponent("navbar-container", path)
        );
    }

    await Promise.all(fetchPromises);

    activateSidebarCurrentPage();

    if (window.UserBindingManager) {
        UserBindingManager.bindAll();
    }

    const preloader = document.getElementById("app-preloader");
    if (preloader) {
        setTimeout(() => {
            preloader.classList.add("fade-out-loader");
            setTimeout(() => preloader.remove(), 400);
        }, 100);
    }
});

