// assets/js/core/global-search.js
(function () {
  "use strict";

  let searchTimeout = null;

  async function performSearch(query) {
    if (!query || !window.supabase) return [];
    
    let results = [];
    const searchStr = `%${query}%`;

    try {
      const isTeacher = window.location.pathname.includes('/teacher/');
      const studentPath = isTeacher ? '../student/' : '';

      // 1. Usuarios (profiles)
      const { data: users } = await window.supabase
        .from('profiles')
        .select('id, name, role')
        .ilike('name', searchStr)
        .limit(5);

      if (users) {
        users.forEach(u => {
          results.push({
            type: 'Usuario',
            label: u.name,
            subLabel: u.role === 'teacher' ? 'Docente' : 'Alumno',
            icon: '👤',
            url: `${studentPath}profile.html?user=${u.id}`
          });
        });
      }

      // 2. Aulas / Secciones (classrooms)
      const { data: classrooms } = await window.supabase
        .from('classrooms')
        .select('id, name, course')
        .ilike('name', searchStr)
        .limit(5);

      if (classrooms) {
        classrooms.forEach(cls => {
          results.push({
            type: 'Aula',
            label: cls.name,
            subLabel: cls.course || 'Aula',
            icon: '🏫',
            url: isTeacher ? `classrooms.html?section=${cls.id}` : `../teacher/classrooms.html?section=${cls.id}`
          });
        });
      }

      // 3. Temas (topics)
      const { data: topics } = await window.supabase
        .from('topics')
        .select('id, name')
        .ilike('name', searchStr)
        .limit(5);

      if (topics) {
        topics.forEach(t => {
          results.push({
            type: 'Tema',
            label: t.name,
            subLabel: 'Tema de estudio',
            icon: '📚',
            url: `${studentPath}roadmap.html?topic=${t.id}` 
          });
        });
      }

      // 4. Actividades / Simulacros / Quizzes (classroom_activities)
      const { data: activities } = await window.supabase
        .from('classroom_activities')
        .select('id, title, type, classroom_id')
        .ilike('title', searchStr)
        .limit(5);

      if (activities) {
        activities.forEach(q => {
          results.push({
            type: 'Tarea',
            label: q.title,
            subLabel: q.type === 'quiz' ? 'Simulacro' : 'Actividad/Tarea',
            icon: '⚡',
            url: isTeacher ? `classrooms.html?section=${q.classroom_id}&activity=${q.id}` : `../teacher/classrooms.html?section=${q.classroom_id}&activity=${q.id}`
          });
        });
      }

      // 5. Círculos de Estudio (circles_table)
      const { data: circles } = await window.supabase
        .from('circles_table')
        .select('id, name, description')
        .ilike('name', searchStr)
        .limit(5);

      if (circles) {
        circles.forEach(c => {
          results.push({
            type: 'Círculo',
            label: c.name,
            subLabel: c.description ? c.description.substring(0, 30) + '...' : 'Círculo de estudio',
            icon: '👥',
            url: `${studentPath}community-circles.html?circle=${c.id}` 
          });
        });
      }

      // 6. Recursos (resources) - Manejar error por si la tabla no existe en Supabase y usa JSON
      const { data: resources, error: resError } = await window.supabase
        .from('resources')
        .select('id, title, type, url')
        .ilike('title', searchStr)
        .limit(5);

      if (!resError && resources) {
        resources.forEach(r => {
          results.push({
            type: 'Recurso',
            label: r.title,
            subLabel: r.type ? r.type.toUpperCase() : 'Material de apoyo',
            icon: '📎',
            url: r.url || '#' 
          });
        });
      } else {
        // Fallback al JSON local si no está en Supabase
        try {
          const res = await fetch('../../mock/resources.json');
          const localRes = await res.json();
          const filteredRes = localRes.filter(r => r.title.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
          filteredRes.forEach(r => {
            results.push({
              type: 'Recurso',
              label: r.title,
              subLabel: r.type ? r.type.toUpperCase() : 'Material de apoyo',
              icon: '📎',
              url: r.url || '#' 
            });
          });
        } catch (e) {
          // Si también falla, lo ignoramos
        }
      }

    } catch (e) {
      console.warn("[global-search] Error al buscar en Supabase:", e);
    }

    return results;
  }

  function renderDropdown(results, inputEl) {
    const wrapper = inputEl.closest('.search-box') || inputEl.closest('.search-wrapper');
    if (!wrapper) return;
    
    const dropdown = wrapper.querySelector('#search-results-dropdown') || wrapper.querySelector('#student-search-results-dropdown');
    if (!dropdown) return;

    if (results.length === 0) {
      dropdown.innerHTML = '<div style="padding:16px; text-align:center; color:var(--sub); font-size:13px;">No hay resultados de busqueda</div>';
      dropdown.classList.remove('hidden');
      return;
    }

    const grouped = {};
    results.forEach(r => {
      if (!grouped[r.type]) grouped[r.type] = [];
      grouped[r.type].push(r);
    });

    let html = '';
    for (const [type, items] of Object.entries(grouped)) {
      if (items.length > 0) {
        html += `<div style="background: rgba(0,0,0,0.03); padding: 8px 16px; font-size: 11px; font-weight: 700; color: var(--sub); text-transform: uppercase;">${type}s</div>`;
        items.forEach(item => { 
          const target = item.url.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : '';
          html += `
            <a href="${item.url}" ${target} class="search-result-item" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; text-decoration: none; border-bottom: 1px solid var(--border); transition: background 0.2s;">
              <div style="font-size: 20px;">${item.icon}</div>
              <div style="display: flex; flex-direction: column;">
                <span style="font-weight: 600; font-size: 14px; color: var(--dark);">${item.label}</span>
                <span style="font-size: 12px; color: var(--sub);">${item.subLabel}</span>
              </div>
            </a>
          `;
        });
      }
    }

    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');

    dropdown.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('mouseenter', () => { el.style.background = 'var(--fill)'; });
      el.addEventListener('mouseleave', () => { el.style.background = 'transparent'; });
    });
  }

  document.body.addEventListener('input', (e) => {
    if (e.target.id === 'globalSearchInput' || e.target.id === 'global-search-input') {
      const query = e.target.value.trim();
      
      const wrapper = e.target.closest('.search-box') || e.target.closest('.search-wrapper');
      const dropdown = wrapper ? (wrapper.querySelector('#search-results-dropdown') || wrapper.querySelector('#student-search-results-dropdown')) : null;
      
      if (!query) {
        if (dropdown) dropdown.classList.add('hidden');
        return;
      }

      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        const results = await performSearch(query);
        renderDropdown(results, e.target);
      }, 300);
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box') && !e.target.closest('.search-wrapper')) {
      const dropdownT = document.getElementById('search-results-dropdown');
      const dropdownS = document.getElementById('student-search-results-dropdown');
      if (dropdownT) dropdownT.classList.add('hidden');
      if (dropdownS) dropdownS.classList.add('hidden');
    }
  });

})();
