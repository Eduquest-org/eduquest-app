document.addEventListener("DOMContentLoaded", async () => {
  if (window.CurrentUserService) {
    await CurrentUserService.init();
  }

  document.querySelectorAll('.student-screen').forEach(screen => {
    if (!screen.classList.contains('active')) {
      screen.style.display = 'none';
    } else {
      screen.style.display = 'block';
    }
  });

  // Renderizar la misión diaria
  renderDailyChallengeWidget();
});

function renderDailyChallengeWidget() {
  const descEl = document.getElementById("challenge-desc");
  const pbarEl = document.getElementById("challenge-pbar");
  const progTextEl = document.getElementById("challenge-progress-text");
  const btnEl = document.getElementById("challenge-action-btn");

  if (!descEl || !pbarEl || !progTextEl || !btnEl) return;

  const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
  if (!user) return;

  // Si no hay reto diario en DB (por migración), crear uno de respaldo para UI
  const challenge = user.dailyChallenge || {
      description: "Completa 2 quizzes hoy para mantener tu racha.",
      current: 0,
      target: 2,
      type: "quiz_questions",
      completed: false
  };

  // 1. Mostrar descripción
  descEl.innerHTML = challenge.description;

  // 2. Mostrar progreso
  const pct = Math.min(100, Math.round((challenge.current / challenge.target) * 100));
  pbarEl.style.width = pct + "%";
  
  let unit = "";
  if (challenge.type === "total_xp") unit = " XP";
  else if (challenge.type === "quiz_questions") unit = " aciertos";
  else if (challenge.type === "create_post") unit = " pub";
  else unit = " compl.";

  progTextEl.innerHTML = `Progreso: ${challenge.current} / ${challenge.target}${unit} (${pct}%)`;

  // 3. Estilo del botón según estado
  if (challenge.completed) {
    pbarEl.style.background = "var(--green)";
    pbarEl.style.boxShadow = "0 0 8px var(--green)";
    btnEl.innerHTML = "¡Misión Cumplida! 🎉";
    btnEl.disabled = true;
    btnEl.style.background = "rgba(29, 158, 117, 0.15)";
    btnEl.style.color = "var(--green)";
    btnEl.style.borderColor = "var(--green)";
    btnEl.style.cursor = "default";
    btnEl.onclick = null;
  } else {
    pbarEl.style.background = "var(--amber)";
    btnEl.disabled = false;
    btnEl.style.cursor = "pointer";
    btnEl.style.background = "";
    btnEl.style.color = "";
    btnEl.style.borderColor = "";

    // Acciones y textos personalizados según el tipo de reto
    if (challenge.type === "create_post") {
      btnEl.innerHTML = "Escribir Duda en Foro";
      btnEl.onclick = () => {
        const postInput = document.getElementById("post-input");
        if (postInput) {
          postInput.focus();
          postInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
    } else if (challenge.type === "total_xp") {
      btnEl.innerHTML = "Ver Mi Ruta IA";
      btnEl.onclick = () => {
        window.location.href = "roadmap.html";
      };
    } else {
      btnEl.innerHTML = "Ir a Practicar";
      btnEl.onclick = () => {
        window.location.href = "quizzes.html";
      };
    }
  }
}




    function toggleCourse(id, headerElement) {
      const content = document.getElementById(id);
      const icon = headerElement.querySelector('.acc-icon');
      
      if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.style.transform = 'rotate(0deg)'; // Flecha apuntando arriba
      } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(180deg)'; // Flecha apuntando abajo
      }
    }
    
    function navigateToStudent(screenId) {
      document.getElementById('student-shell').style.display = 'flex';
      
      document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
      });

      document.querySelectorAll('.student-screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none'; 
      });
      
      document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('on'));
      
      const targetScreen = document.getElementById(screenId);
      if(targetScreen) {
        targetScreen.style.display = 'block'; 
        setTimeout(() => targetScreen.classList.add('active'), 10);
      }
      
      const targetNav = document.getElementById('nav-' + screenId.replace('s-', ''));
      if(targetNav) targetNav.classList.add('on');
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function navigateToFocus(screenId) {
      document.getElementById('student-shell').style.display = 'none';
      
      document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
      });
      
      const targetScreen = document.getElementById(screenId);
      if(targetScreen) {
        targetScreen.style.display = 'block';
        setTimeout(() => targetScreen.classList.add('active'), 10);
      }
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function selectOption(element) {
      const container = element.parentElement;
      container.querySelectorAll('.qopt').forEach(opt => opt.classList.remove('sel'));
      element.classList.add('sel');
    }

