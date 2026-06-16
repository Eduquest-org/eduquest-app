/* assets/js/teacher/classrooms.js */

/* ============== Datos de muestra ============== */
const avatarColors = ['#6E61E0','#B45309','#0E8F86','#C2486B','#516390'];

const ICONS = {
  Física: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="9.5" ry="4.2"/><ellipse cx="12" cy="12" rx="9.5" ry="4.2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="4.2" transform="rotate(120 12 12)"/></svg>`,
  "Álgebra": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18c4-14 8-14 8 0M12 18c4-14 8-14 8 0"/></svg>`,
  Química: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6.5L4.6 18a2 2 0 0 0 1.7 3h11.4a2 2 0 0 0 1.7-3L14 9.5V3"/><path d="M7.5 14h9"/></svg>`,
  "Razonamiento Matemático": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><circle cx="8" cy="10.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="12" cy="10.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="16" cy="10.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="8" cy="14.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="12" cy="14.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="16" cy="14.5" r="0.9" fill="currentColor" stroke="none"/><line x1="8" y1="18.5" x2="16" y2="18.5"/></svg>`
};

const COURSE_THEME = {
  Física: { color:'var(--brand)', soft:'var(--brand-soft)' },
  "Álgebra": { color:'var(--amber-dark)', soft:'var(--amber-soft)' },
  Química: { color:'var(--teal)', soft:'var(--teal-soft)' },
  "Razonamiento Matemático": { color:'var(--rose)', soft:'var(--rose-soft)' }
};

const sections = [
  {
    id:'fis-a', course:'Física', name:'Física · Sección A', teacher:'32 alumnos · Profesor titular: tú',
    students:32, avgXp:2140, activity:78,
    list:[
      {name:'Valentina Ríos', xp:3420, activity:'Completó el simulacro de Física'},
      {name:'Diego Salazar', xp:3180, activity:'Resolvió 6 ejercicios de dinámica'},
      {name:'Camila Torres', xp:2950, activity:'Vio la clase de energía y trabajo'},
      {name:'Mateo Flores', xp:2710, activity:'Subió su tarea de MRUV'},
      {name:'Sofía Ramos', xp:2540, activity:'Comentó en una duda de vectores'},
      {name:'Bruno Castillo', xp:2380, activity:'Resolvió 4 ejercicios de cinemática'},
      {name:'Renata Quispe', xp:2210, activity:'Completó el quiz de fuerzas'},
      {name:'Joaquín Vega', xp:1980, activity:'Vio la clase de movimiento circular'},
      {name:'Luciana Paredes', xp:1720, activity:'Resolvió 2 ejercicios de cinemática'},
      {name:'Iker Ponce', xp:1340, activity:'Se unió a la sección'}
    ]
  },
  {
    id:'alg-b', course:'Álgebra', name:'Álgebra · Sección B', teacher:'28 alumnos · Profesor titular: tú',
    students:28, avgXp:1860, activity:65,
    list:[
      {name:'Ana Belén Soto', xp:3050, activity:'Completó el quiz de ecuaciones'},
      {name:'Rodrigo Núñez', xp:2870, activity:'Resolvió 8 ejercicios de factorización'},
      {name:'Fernanda Salas', xp:2690, activity:'Practicó sistemas de ecuaciones'},
      {name:'Sebastián Rojas', xp:2430, activity:'Vio la clase de funciones cuadráticas'},
      {name:'Paula Medina', xp:2260, activity:'Comentó en una duda de álgebra'},
      {name:'Nicolás Herrera', xp:2050, activity:'Resolvió 5 ejercicios de factorización'},
      {name:'Daniela Cruz', xp:1890, activity:'Completó el simulacro de Álgebra'},
      {name:'Emilio Vargas', xp:1640, activity:'Vio la clase de inecuaciones'},
      {name:'Ximena Cabrera', xp:1410, activity:'Resolvió 3 ejercicios de ecuaciones'},
      {name:'Tomás Ibáñez', xp:1180, activity:'Se unió a la sección'}
    ]
  },
  {
    id:'qui-c', course:'Química', name:'Química · Sección C', teacher:'25 alumnos · Profesor titular: tú',
    students:25, avgXp:1990, activity:82,
    list:[
      {name:'Gabriela Montes', xp:2980, activity:'Completó el laboratorio de estequiometría'},
      {name:'Andrés Paredes', xp:2740, activity:'Resolvió ejercicios de tabla periódica'},
      {name:'Carla Espinoza', xp:2510, activity:'Vio la clase de enlace químico'},
      {name:'Leonardo Díaz', xp:2290, activity:'Completó el quiz de nomenclatura'},
      {name:'Milagros Chávez', xp:2080, activity:'Comentó en una duda de química'},
      {name:'Cristian Vela', xp:1860, activity:'Resolvió 4 ejercicios de moles'},
      {name:'Antonella Ruiz', xp:1620, activity:'Vio la clase de gases ideales'},
      {name:'Franco Aguilar', xp:1390, activity:'Resolvió 2 ejercicios de soluciones'},
      {name:'Yamile Torres', xp:1150, activity:'Se unió a la sección'},
      {name:'Said Campos', xp:980, activity:'Se unió a la sección'}
    ]
  },
  {
    id:'rm-d', course:'Razonamiento Matemático', name:'Raz. Matemático · Sección D', teacher:'30 alumnos · Profesor titular: tú',
    students:30, avgXp:2050, activity:71,
    list:[
      {name:'Kevin Salazar', xp:3310, activity:'Completó el simulacro UNI'},
      {name:'Brenda Quiroz', xp:3120, activity:'Resolvió 10 problemas de lógica'},
      {name:'Aaron Delgado', xp:2860, activity:'Vio la clase de sucesiones'},
      {name:'Nayeli Ortiz', xp:2600, activity:'Completó el quiz de analogías'},
      {name:'Esteban Lara', xp:2370, activity:'Resolvió 6 problemas de edades'},
      {name:'Ariana Ponce', xp:2150, activity:'Comentó en una duda de lógica'},
      {name:'Gianmarco Ríos', xp:1920, activity:'Vio la clase de proporciones'},
      {name:'Talía Reyes', xp:1680, activity:'Resolvió 3 problemas de lógica'},
      {name:'Eduardo Sosa', xp:1430, activity:'Se unió a la sección'},
      {name:'Camila Nuñez', xp:1190, activity:'Se unió a la sección'}
    ]
  }
];

/* ============== Helpers ============== */
function initials(name){
  return name.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase();
}
function ligaFor(xp){
  if(xp>=2800) return {label:'Liga Platino', cls:'plat'};
  if(xp>=2000) return {label:'Liga Oro', cls:'oro'};
  if(xp>=1200) return {label:'Liga Plata', cls:'plata'};
  return {label:'Liga Bronce', cls:'bronce'};
}

/* ============== Render: tarjetas de sección ============== */
const sectionGrid = document.getElementById('sectionGrid');

function renderSectionGrid(filter){
  if(!sectionGrid) return;
  sectionGrid.innerHTML = '';
  sections
    .filter(s => filter === 'todas' || s.course === filter)
    .forEach(s => {
      const theme = COURSE_THEME[s.course];
      const stack = s.list.slice(0,3).map((st,i)=>
        `<div class="mini-avatar" style="background:${avatarColors[i % avatarColors.length]}">${initials(st.name)}</div>`
      ).join('');

      const card = document.createElement('div');
      card.className = 'section-card';
      card.innerHTML = `
        <div class="course-icon-chip" style="background:${theme.soft};color:${theme.color}">${ICONS[s.course]}</div>
        <h4>${s.name}</h4>
        <div class="course-tag">${s.teacher}</div>
        <div class="section-card-stats">
          <div class="stat"><div class="num">${s.students}</div><div class="lbl">Alumnos</div></div>
          <div class="stat"><div class="num">${s.avgXp.toLocaleString('es-PE')}</div><div class="lbl">XP promedio</div></div>
          <div class="stat"><div class="num">${s.activity}%</div><div class="lbl">Actividad</div></div>
        </div>
        <div class="avatar-stack">${stack}<span class="more">+${s.students - 3} alumnos</span></div>
        <div class="enter-row">Ver actividad
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      `;
      card.addEventListener('click', () => openSection(s.id));
      sectionGrid.appendChild(card);
    });
}

const filterChips = document.getElementById('filterChips');
if(filterChips) {
  filterChips.addEventListener('click', e=>{
    const chip = e.target.closest('.chip');
    if(!chip) return;
    document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
    chip.classList.add('active');
    renderSectionGrid(chip.dataset.course);
  });
}

/* ============== Render: detalle de sección ============== */
const screenSelect = document.getElementById('screen-select');
const screenDetail = document.getElementById('screen-detail');
let currentRest = [];

function openSection(id){
  const s = sections.find(x => x.id === id);
  if(!s) return;

  const theme = COURSE_THEME[s.course];
  const detailIconChip = document.getElementById('detailIconChip');
  if(detailIconChip) {
    detailIconChip.style.background = theme.soft;
    detailIconChip.style.color = theme.color;
    detailIconChip.innerHTML = ICONS[s.course];
  }

  const detailTitle = document.getElementById('detailTitle');
  if(detailTitle) detailTitle.textContent = s.name;

  const detailSubtitle = document.getElementById('detailSubtitle');
  if(detailSubtitle) detailSubtitle.textContent = s.teacher;

  const detailAvgXp = document.getElementById('detailAvgXp');
  if(detailAvgXp) detailAvgXp.textContent = s.avgXp.toLocaleString('es-PE') + ' XP';

  const detailActivity = document.getElementById('detailActivity');
  if(detailActivity) detailActivity.textContent = s.activity + '%';

  const detailCount = document.getElementById('detailCount');
  if(detailCount) detailCount.textContent = s.students;

  const sorted = [...s.list].sort((a,b)=>b.xp - a.xp);
  const top3 = sorted.slice(0,3);
  currentRest = sorted.slice(3);

  const podium = document.getElementById('podium');
  const medalCls = ['gold','silver','bronze'];
  if(podium) {
    podium.innerHTML = top3.map((st,i)=>{
      const liga = ligaFor(st.xp);
      return `
        <div class="podium-card rank-${i+1}">
          <div class="medal ${medalCls[i]}">${i+1}</div>
          <div class="podium-avatar" style="background:${avatarColors[i % avatarColors.length]}">${initials(st.name)}</div>
          <div class="podium-name">${st.name}</div>
          <div class="podium-xp">${st.xp.toLocaleString('es-PE')} <span>XP</span></div>
          <div class="podium-liga rank-liga ${liga.cls}">${liga.label}</div>
        </div>`;
    }).join('');
  }

  const studentSearch = document.getElementById('studentSearch');
  if(studentSearch) studentSearch.value = '';
  renderRestList(currentRest);

  if(screenSelect) screenSelect.classList.add('hidden');
  if(screenDetail) screenDetail.classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderRestList(list){
  const rankList = document.getElementById('rankList');
  if(!rankList) return;
  if(list.length === 0){
    rankList.innerHTML = '<div class="empty-row">No se encontraron alumnos con ese nombre.</div>';
    return;
  }
  rankList.innerHTML = list.map((st,i)=>{
    const liga = ligaFor(st.xp);
    return `
      <div class="rank-row">
        <div class="rank-num">${i+4}</div>
        <div class="rank-avatar" style="background:${avatarColors[(i+3) % avatarColors.length]}">${initials(st.name)}</div>
        <div>
          <div class="rank-name">${st.name}</div>
          <div class="rank-activity">${st.activity}</div>
        </div>
        <div class="rank-liga ${liga.cls}">${liga.label}</div>
        <div class="rank-xp">${st.xp.toLocaleString('es-PE')}<span>XP</span></div>
      </div>`;
  }).join('');
}

const studentSearch = document.getElementById('studentSearch');
if(studentSearch) {
  studentSearch.addEventListener('input', e=>{
    const q = e.target.value.trim().toLowerCase();
    const filtered = currentRest.filter(st => st.name.toLowerCase().includes(q));
    renderRestList(filtered);
  });
}

document.querySelectorAll('.toolbar-tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    document.querySelectorAll('.toolbar-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
  });
});

const backLink = document.getElementById('backLink');
if(backLink) {
  backLink.addEventListener('click', ()=>{
    if(screenDetail) screenDetail.classList.add('hidden');
    if(screenSelect) screenSelect.classList.remove('hidden');
    window.scrollTo({top:0,behavior:'smooth'});
  });
}

/* ============== Init ============== */
renderSectionGrid('todas');
