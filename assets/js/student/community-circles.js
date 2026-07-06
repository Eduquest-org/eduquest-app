import { CirclesManager, UserCirclesManager, SubjectManager } from '../core/circles-manager.js';

// ============================================================
// Estado del módulo
// ============================================================
let allCircles   = [];   // Caché de todos los círculos traídos de Supabase
let userCircles  = [];   // Membresías del usuario (rows de circles_table_student)
let allSubjects  = [];   // Caché de todos los cursos
let activeCourseFilter = 'ALL';

// ============================================================
// Helpers de color de materias
// ============================================================
function getCourseColor(courseId) {
    const map = {
        'course_algebra':           'var(--algebra)',
        'course_aritmetica':        'var(--aritmetica)',
        'course_biologia':          'var(--biologia)',
        'course_civica':            'var(--EducaciónCivica)',
        'course_economia':          'var(--Economía)',
        'course_filosofia':         'var(--Filosofía)',
        'course_fisica':            'var(--Física)',
        'course_geografia':         'var(--Geografía)',
        'course_geometria':         'var(--Geometría)',
        'course_historia_peru':     'var(--HistoriaPeru)',
        'course_historia_universal':'var(--HistoriaUniver)',
        'course_ingles':            'var(--Ingles)',
        'course_lectura':           'var(--ComprensionLectora)',
        'course_lenguaje':          'var(--Lenguaje)',
        'course_literatura':        'var(--Literatura)',
        'course_logica':            'var(--Logica)',
        'course_probabilidad':      'var(--Probabilidad)',
        'course_psicologia':        'var(--Psicologia)',
        'course_quimica':           'var(--Quimica)',
        'course_rm':                'var(--RazonaMatematico)',
        'course_rv':                'var(--RazonamientoVerbal)',
        'course_trigonometrica':    'var(--Trigonometria)',
    };
    return map[courseId] || 'var(--muted)';
}

// ============================================================
// Inicialización
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    if (window.CurrentUserService) {
        await CurrentUserService.init();
    }

    // Carga paralela: círculos, membresías del usuario y materias
    const userId = window.CurrentUserService?.getId();
    [allCircles, allSubjects, userCircles] = await Promise.all([
        CirclesManager.getAllCircles(),
        SubjectManager.getAllSubjects(),
        userId ? UserCirclesManager.getCirclesByUserId(userId) : Promise.resolve([]),
    ]);

    allCircles  = allCircles  || [];
    allSubjects = allSubjects || [];
    userCircles = userCircles || [];

    buildCommunityProfileBanner();
    renderFilterTabs();
    renderCirclesStream();
    renderMisCirculos();

    setTimeout(() => {
        const preloader = document.getElementById('app-preloader');
        if (preloader) preloader.classList.add('fade-out-loader');
    }, 350);
});

// ============================================================
// Banner de perfil
// ============================================================
function buildCommunityProfileBanner() {
    const container = document.getElementById('community-profile-summary');
    if (!container) return;

    container.innerHTML = `
        <div class="profile-express-left">
            <div class="profile-express-avatar" data-user-avatar></div>
            <div class="profile-express-welcome">
                <h3>Comunidad de <span data-user-firstname></span></h3>
                <p><span data-user-target></span> • <span data-user-career></span></p>
            </div>
        </div>
        <div class="profile-express-stats">
            <div class="express-stat-item">
                <span id="banner-joined-count" class="express-stat-val" style="color: var(--indigo);">0 Salas</span>
                <span class="express-stat-label">Mis Círculos</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--green);" data-user-xp></span>
                <span class="express-stat-label">XP Total</span>
            </div>
            <div class="express-stat-item">
                <span class="express-stat-val" style="color: var(--amber);">🔥 <span data-user-streak></span></span>
                <span class="express-stat-label">Racha Activa</span>
            </div>
        </div>
    `;

    if (window.UserBindingManager) UserBindingManager.bindAll();
    updateBannerCount();
}

function updateBannerCount() {
    const el = document.getElementById('banner-joined-count');
    if (!el) return;
    const count = userCircles.length;
    el.innerText = `${count} ${count === 1 ? 'Sala' : 'Salas'}`;
}

// ============================================================
// Tabs de filtrado dinámicos
// ============================================================
function renderFilterTabs() {
    const bar = document.getElementById('filter-tabs-bar');
    if (!bar) return;

    // Extraer las materias que realmente tienen círculos
    const usedThemeIds = [...new Set(allCircles.map(c => c.id_theme).filter(Boolean))];
    const usedSubjects = allSubjects.filter(s => usedThemeIds.includes(s.id));

    let html = `<button class="tab-btn active" id="tab-ALL" onclick="filterCirclesByCourse('ALL')">Todos los círculos</button>`;
    usedSubjects.forEach(s => {
        html += `<button class="tab-btn" id="tab-${s.id}" onclick="filterCirclesByCourse('${s.id}')">${s.icon || ''} ${s.name}</button>`;
    });
    bar.innerHTML = html;
}

// ============================================================
// Grid de círculos
// ============================================================
function renderCirclesStream() {
    const container = document.getElementById('active-circles-container');
    if (!container) return;

    const filtered = activeCourseFilter === 'ALL'
        ? allCircles
        : allCircles.filter(c => c.id_theme === activeCourseFilter);

    if (!filtered.length) {
        container.innerHTML = `
            <div class="circles-empty-state">
                <span>🔒</span>
                <p>No hay círculos activos${activeCourseFilter !== 'ALL' ? ' para esta materia' : ''}.<br>¡Sé el primero en crear uno!</p>
            </div>`;
        return;
    }

    container.innerHTML = '';
    filtered.forEach(circle => {
        const isMember = userCircles.some(uc => uc.id_circle === circle.id);
        const subject  = allSubjects.find(s => s.id === circle.id_theme);
        const color    = getCourseColor(circle.id_theme);

        const card = document.createElement('div');
        card.className = `circle-item-card ${isMember ? 'joined-active' : ''}`;
        card.dataset.circleId = circle.id;

        card.innerHTML = `
            <div class="circle-card-header">
                <span class="circle-course-badge" style="color:${color}; background:color-mix(in srgb, ${color} 12%, transparent)">
                    ${subject?.name || 'General'}
                </span>
                <span class="circle-meta-members">👥 ${circle.number_students ?? 0}</span>
            </div>
            <h3>${circle.name}</h3>
            <p>${circle.description || 'Círculo de estudio colaborativo.'}</p>
            <button
                class="btn-join-circle"
                id="btn-circle-${circle.id}"
                onclick="toggleCircleMembership('${circle.id}')">
                ${isMember ? '🟢 Dentro del Círculo' : 'Unirse al Círculo'}
            </button>
        `;
        container.appendChild(card);
    });
}

// ============================================================
// Sidebar — Mis Círculos
// ============================================================
async function renderMisCirculos() {
    const list = document.getElementById('mis-circulos-list');
    if (!list) return;

    if (!userCircles.length) {
        list.innerHTML = `<p class="mis-circulos-empty">Aún no perteneces a ningún círculo.</p>`;
        return;
    }

    list.innerHTML = '';
    userCircles.forEach(membership => {
        const circle  = allCircles.find(c => c.id === membership.id_circle);
        if (!circle) return;

        const subject = allSubjects.find(s => s.id === circle.id_theme);
        const color   = getCourseColor(circle.id_theme);
        const isOwner = membership.role === 'admin';

        const item = document.createElement('div');
        item.className = 'mis-circulos-item';
        item.id = `mis-circulos-item-${circle.id}`;
        item.innerHTML = `
            <div class="mis-circulos-info">
                <span class="mis-circulos-badge" style="color:${color}; background:color-mix(in srgb, ${color} 12%, transparent)">
                    ${subject?.name || 'General'}
                </span>
                <strong class="mis-circulos-name">${circle.name}</strong>
            </div>
            <button
                class="btn-leave-circle ${isOwner ? 'btn-leave-disabled' : ''}"
                onclick="toggleCircleMembership('${circle.id}')"
                ${isOwner ? 'title="Eres el admin, no puedes salir" disabled' : 'title="Salir del círculo"'}>
                ${isOwner ? '👑' : '✕'}
            </button>
        `;
        list.appendChild(item);
    });
}

// ============================================================
// Filtrar por materia
// ============================================================
window.filterCirclesByCourse = function(courseId) {
    activeCourseFilter = courseId;

    document.querySelectorAll('#filter-tabs-bar .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === `tab-${courseId}`);
    });

    renderCirclesStream();
};

// ============================================================
// Búsqueda por nombre (filtrado en memoria)
// ============================================================
window.searchCircles = function(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
        renderCirclesStream();
        return;
    }
    const container = document.getElementById('active-circles-container');
    if (!container) return;

    const source = activeCourseFilter === 'ALL'
        ? allCircles
        : allCircles.filter(c => c.id_theme === activeCourseFilter);

    const filtered = source.filter(c => c.name.toLowerCase().includes(q));

    container.innerHTML = '';
    if (!filtered.length) {
        container.innerHTML = `
            <div class="circles-empty-state">
                <span>🔍</span>
                <p>No encontramos círculos con ese nombre.</p>
            </div>`;
        return;
    }

    filtered.forEach(circle => {
        const isMember = userCircles.some(uc => uc.id_circle === circle.id);
        const subject  = allSubjects.find(s => s.id === circle.id_theme);
        const color    = getCourseColor(circle.id_theme);

        const card = document.createElement('div');
        card.className = `circle-item-card ${isMember ? 'joined-active' : ''}`;
        card.dataset.circleId = circle.id;
        card.innerHTML = `
            <div class="circle-card-header">
                <span class="circle-course-badge" style="color:${color}; background:color-mix(in srgb, ${color} 12%, transparent)">
                    ${subject?.name || 'General'}
                </span>
                <span class="circle-meta-members">👥 ${circle.number_students ?? 0}</span>
            </div>
            <h3>${circle.name}</h3>
            <p>${circle.description || 'Círculo de estudio colaborativo.'}</p>
            <button class="btn-join-circle" id="btn-circle-${circle.id}" onclick="toggleCircleMembership('${circle.id}')">
                ${isMember ? '🟢 Dentro del Círculo' : 'Unirse al Círculo'}
            </button>
        `;
        container.appendChild(card);
    });
};

// ============================================================
// Join / Leave
// ============================================================
window.toggleCircleMembership = async function(circleId) {
    const userId = window.CurrentUserService?.getId();
    if (!userId) return;

    const btn = document.getElementById(`btn-circle-${circleId}`);
    if (btn) { btn.disabled = true; btn.innerText = '...'; }

    const alreadyMember = userCircles.some(uc => uc.id_circle === circleId);

    if (alreadyMember) {
        const ok = await UserCirclesManager.leaveCircle(circleId, userId);
        if (ok) {
            userCircles = userCircles.filter(uc => uc.id_circle !== circleId);
            // Actualizar contador local del círculo
            const circle = allCircles.find(c => c.id === circleId);
            if (circle) circle.number_students = Math.max(0, (circle.number_students || 1) - 1);
        }
    } else {
        const membership = await UserCirclesManager.createConectionCircleStudent('member', circleId, userId);
        if (membership) {
            userCircles.push(membership);
            const circle = allCircles.find(c => c.id === circleId);
            if (circle) circle.number_students = (circle.number_students || 0) + 1;
        }
    }

    updateBannerCount();
    renderCirclesStream();
    renderMisCirculos();
};

// ============================================================
// Modal — Crear círculo
// ============================================================
window.openCreateCircleModal = async function() {
    const modal = document.getElementById('create-circle-modal');
    if (!modal) return;

    // Poblar el select de materias
    const select = document.getElementById('modal-circle-theme');
    if (select && allSubjects.length) {
        select.innerHTML = `<option value="">— Selecciona una materia —</option>`;
        allSubjects.forEach(s => {
            select.innerHTML += `<option value="${s.id}">${s.icon || ''} ${s.name}</option>`;
        });
    }

    modal.classList.add('open');
    document.getElementById('modal-circle-name')?.focus();
};

window.closeCreateCircleModal = function() {
    const modal = document.getElementById('create-circle-modal');
    if (modal) modal.classList.remove('open');
    document.getElementById('create-circle-form')?.reset();
    clearModalError();
};

window.submitCreateCircle = async function(e) {
    e.preventDefault();
    const userId = window.CurrentUserService?.getId();
    if (!userId) return;

    const name  = document.getElementById('modal-circle-name')?.value.trim();
    const desc  = document.getElementById('modal-circle-desc')?.value.trim();
    const theme = document.getElementById('modal-circle-theme')?.value;

    if (!name)  return showModalError('El nombre del círculo es obligatorio.');
    if (!theme) return showModalError('Selecciona una materia para el círculo.');

    // Verificar duplicado por nombre
    const dupes = await CirclesManager.getCirclesByOwnerAndName(userId, name);
    if (dupes && dupes.length) return showModalError('Ya tienes un círculo con ese nombre.');

    const submitBtn = document.getElementById('modal-submit-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Creando...'; }

    const newCircle = await CirclesManager.createCircle(name, desc, theme, userId);

    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Crear Círculo'; }

    if (!newCircle) {
        return showModalError('Hubo un error al crear el círculo. Intenta de nuevo.');
    }

    // Actualizar estado local
    allCircles.unshift(newCircle);
    userCircles.push({ id_circle: newCircle.id, id_student: userId, role: 'admin' });

    closeCreateCircleModal();
    updateBannerCount();
    renderFilterTabs();
    renderCirclesStream();
    renderMisCirculos();
};

function showModalError(msg) {
    const el = document.getElementById('modal-error-msg');
    if (el) { el.innerText = msg; el.style.display = 'block'; }
}
function clearModalError() {
    const el = document.getElementById('modal-error-msg');
    if (el) { el.innerText = ''; el.style.display = 'none'; }
}

// Cerrar modal al hacer click fuera
document.addEventListener('click', e => {
    const modal = document.getElementById('create-circle-modal');
    if (modal && e.target === modal) closeCreateCircleModal();
});