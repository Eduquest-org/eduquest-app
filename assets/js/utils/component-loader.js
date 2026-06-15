// ==========================================================================
// assets/js/utils/component-loader.js
// CARGADOR GLOBAL DE COMPONENTES MODULARES (EDUQUEST SAAS)
// ==========================================================================

// Función asíncrona infalible para descargar e inyectar fragmentos HTML
async function loadComponent(containerId, path) {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        const response = await fetch(path);
        const html = await response.text();
        container.innerHTML = html;
        GlobalLoader.hide(500); 
        return true; // Retorna éxito para el control de promesas
    } catch (error) {
        console.error(`Error crítico cargando el componente [${containerId}]:`, error);
        return false;
    }
    
}

// Función inteligente que detecta la URL actual e ilumina el botón correcto
function activateSidebarCurrentPage() {
    // 1. Capturar el nombre del archivo en el que está parado el alumno
    const currentPath = window.location.pathname;
    let currentPage = currentPath.substring(currentPath.lastIndexOf('/') + 1);
    
    // Si la URL termina en vacío o en la raíz, asumimos que es el inicio
    if (currentPage === "" || currentPage === "index.html") {
        currentPage = "dashboard.html";
    }

    // 2. Buscar los botones dentro del menú lateral inyectado
    const sidebarItems = document.querySelectorAll('.sidebar .sb-item, .sb-nav .sb-item');
    
    // 🔥 UX BLINDAJE ANTI-RACE CONDITION: 
    // Si la red aún no termina de inyectar el HTML, los elementos serán 0.
    // Programamos un reintento inmediato en 30ms en lugar de apagar el script.
    if (sidebarItems.length === 0) {
        setTimeout(activateSidebarCurrentPage, 30);
        return;
    }

    // 3. Recorrer los botones y encender el que coincida con el archivo actual
    sidebarItems.forEach(item => {
        const targetPage = item.getAttribute('data-page');

        if (currentPage === targetPage) {
            item.classList.add('on'); // Pinta el botón de verde con opacidad
            
            // Encender el puntito interno si tu hoja de estilos lo requiere
            const dot = item.querySelector('.sb-dot');
            if (dot) dot.classList.add('g'); 
        } else {
            item.classList.remove('on');
        }
    });
}

// Disparador principal cuando el árbol DOM de la página esté listo
document.addEventListener("DOMContentLoaded", async () => {
    const fetchPromises = [];


    // Capturar e iniciar la carga del Topbar dinámico
    const topbarContainer = document.getElementById("topbar-container");
    if (topbarContainer) {
        const path = topbarContainer.getAttribute("data-path");
        fetchPromises.push(loadComponent("topbar-container", path));
    }

    // Capturar e iniciar la carga del Sidebar dinámico
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

    // Esperar de forma segura que terminen TODAS las peticiones HTTP en paralelo
    await Promise.all(fetchPromises);

    // Ejecutar el activador de estados del menú
    activateSidebarCurrentPage();

    // Retirar el velo de la pantalla de carga con una transición fluida
    const preloader = document.getElementById("app-preloader");
    if (preloader) {
        setTimeout(() => {
            preloader.classList.add("fade-out-loader");
            // Remover físicamente del DOM para liberar memoria del navegador
            setTimeout(() => preloader.remove(), 400);
        }, 100);
    }
});