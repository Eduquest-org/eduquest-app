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
  
  // Renderizar widget de rendimiento
  await renderDashboardRendimientoWidget();
  
  // Renderizar Top 3 Dinámico
  await renderTop3Ranking();
});

async function renderTop3Ranking() {
  const rankingListEl = document.getElementById("dashboard-ranking-list");
  if (!rankingListEl) return;
  
  const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
  if (!user) return;
  
  rankingListEl.innerHTML = '<div style="text-align:center; padding: 20px; font-size:12px; color:var(--sub);">Cargando ranking...</div>';

  try {
    // 1. Obtener el aula del usuario actual (la última aula a la que se unió o cualquier aula activa)
    const { data: enrollments, error: enrErr } = await window.supabase
        .from('classroom_students')
        .select('classroom_id')
        .eq('student_id', user.id);
        
    if (enrErr) throw enrErr;
    if (!enrollments || enrollments.length === 0) {
        rankingListEl.innerHTML = '<div style="text-align:center; padding: 20px; font-size:12px; color:var(--sub);">Únete a un aula para competir.</div>';
        return;
    }
    
    // Tomar la primera aula
    const classId = enrollments[0].classroom_id;
    
    // 2. Obtener todos los estudiantes del aula
    const { data: studentsEnrolled, error: stuErr } = await window.supabase
        .from('classroom_students')
        .select('student_id, profiles:student_id(name)')
        .eq('classroom_id', classId);
        
    if (stuErr) throw stuErr;
    if (!studentsEnrolled || studentsEnrolled.length === 0) return;
    
    const studentIds = studentsEnrolled.map(e => e.student_id);
    
    // 3. Obtener el progreso (XP total) de esos estudiantes desde user_topic_progress
    const { data: stats, error: statsErr } = await window.supabase
        .from('user_topic_progress')
        .select('user_id, score')
        .in('user_id', studentIds);
        
    if (statsErr) throw statsErr;
    
    // Sumar XP
    let xpMap = {};
    studentsEnrolled.forEach(s => {
        xpMap[s.student_id] = { name: s.profiles?.name || 'Alumno', xp: 0, isMe: s.student_id === user.id };
    });
    
    if (stats) {
        stats.forEach(st => {
            if (xpMap[st.user_id]) {
                xpMap[st.user_id].xp += (st.score || 0) * 10; // 1 pt = 10 XP aprox para el visual
            }
        });
    }
    
    // Ordenar Top 3
    const sorted = Object.values(xpMap).sort((a, b) => b.xp - a.xp).slice(0, 3);
    
    if (sorted.length === 0) {
        rankingListEl.innerHTML = '<div style="text-align:center; padding: 20px; font-size:12px; color:var(--sub);">No hay datos de ranking.</div>';
        return;
    }
    
    const escapeHtml = (unsafe) => {
        return (unsafe || '').toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    };
    
    const medals = ['🎓', '🧠', '⚡'];
    rankingListEl.innerHTML = sorted.map((st, i) => {
        const isMeStyle = st.isMe ? 'background: rgba(29, 158, 117, 0.1); border-radius: 8px; padding: 6px 8px;' : '';
        const rankColor = st.isMe ? 'color: var(--green);' : '';
        const nameHtml = st.isMe ? `<strong>Tú (${escapeHtml(st.name)})</strong>` : escapeHtml(st.name);
        
        return `
            <li style="${isMeStyle}">
              <div class="rank-user">
                <span class="rank-num" style="${rankColor}">${i + 1}</span>
                <span class="user-avatar-mini" style="width: 28px; height: 28px; font-size: 14px;">${medals[i] || '⭐'}</span>
                ${nameHtml}
              </div>
              <span class="rank-pts">${st.xp.toLocaleString()} XP</span>
            </li>
        `;
    }).join('');

  } catch(err) {
      console.error("Error al cargar ranking dinámico:", err);
      rankingListEl.innerHTML = '<div style="text-align:center; padding: 20px; font-size:12px; color:var(--sub);">Error cargando ranking</div>';
  }
}

function renderDailyChallengeWidget() {
  const descEl = document.getElementById("challenge-desc");
  const pbarEl = document.getElementById("challenge-pbar");
  const progTextEl = document.getElementById("challenge-progress-text");
  const btnEl = document.getElementById("challenge-action-btn");

  if (!descEl || !pbarEl || !progTextEl || !btnEl) return;

  const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
  if (!user) return;

  let challenge = null;
  if (user && user.stats && user.stats.dailyChallenge) {
      challenge = user.stats.dailyChallenge;
  } else {
      try { challenge = JSON.parse(localStorage.getItem('dailyChallenge')); } catch (e) {}
  }
  
  if (!challenge) {
      challenge = {
          description: "Completa 2 quizzes hoy para mantener tu racha.",
          current: 0,
          target: 2,
          type: "quiz_questions",
          completed: false
      };
  }

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

async function renderDashboardRendimientoWidget() {
  const chartEl = document.getElementById("dashboard-rendimiento-chart");
  const pctEl = document.getElementById("dashboard-chart-pct");
  if (!chartEl || !pctEl) return;

  const user = window.CurrentUserService ? CurrentUserService.getProfile() : null;
  if (!user) return;

  let statsData = [];
  if (window.UserManager) {
      statsData = await UserManager.getAllUserTopicStats(user.id);
  }

  let totalCorrect = 0;
  let totalQuestions = 0;

  statsData.forEach(stat => {
      const correct = stat.correct_answers || 0;
      const incorrect = stat.incorrect_answers || 0;
      totalCorrect += correct;
      totalQuestions += (correct + incorrect);
  });

  if (totalQuestions === 0) {
      chartEl.style.background = "conic-gradient(#cbd5e1 0deg 360deg)";
      pctEl.innerText = "-";
      return;
  }

  const correctPct = Math.round((totalCorrect / totalQuestions) * 100);
  pctEl.innerText = correctPct + "%";

  const correctDeg = (totalCorrect / totalQuestions) * 360;
  
  if (totalCorrect === 0) {
      chartEl.style.background = "conic-gradient(#ef4444 0deg 360deg)";
  } else if (totalCorrect === totalQuestions) {
      chartEl.style.background = "conic-gradient(#22c55e 0deg 360deg)";
  } else {
      const gap = 4;
      const cEnd = correctDeg - gap / 2;
      const iStart = correctDeg + gap / 2;
      const iEnd = 360 - gap / 2;
      
      chartEl.style.background = `conic-gradient(
          #ffffff 0deg ${gap/2}deg,
          #22c55e ${gap/2}deg ${cEnd}deg, 
          #ffffff ${cEnd}deg ${iStart}deg,
          #ef4444 ${iStart}deg ${iEnd}deg,
          #ffffff ${iEnd}deg 360deg
      )`;
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

