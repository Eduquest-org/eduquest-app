// assets/js/teacher/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
  // Solo controla el sidebar de muestra en vista móvil.
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('backdrop');
  const toggle = document.getElementById('menuToggle');
  
  function closeMenu(){
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
  }
  
  toggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('open');
  });
  
  backdrop?.addEventListener('click', closeMenu);
});
