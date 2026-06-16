// assets/js/teacher/dashboard.js

// Usamos event delegation porque los componentes (sidebar, navbar) se cargan de forma asíncrona.
document.addEventListener('click', (e) => {
  const toggle = e.target.closest('#menuToggle');
  const backdrop = document.getElementById('backdrop');
  const sidebar = document.getElementById('sidebar');

  // Si se hace clic en el botón de toggle (hamburguesa)
  if (toggle) {
    if (sidebar) sidebar.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('open');
    return;
  }

  // Si se hace clic en el backdrop (fondo oscuro en móvil)
  if (e.target === backdrop) {
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  }
});
