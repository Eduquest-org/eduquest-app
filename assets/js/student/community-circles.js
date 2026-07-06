import { CirclesManager, UserCirclesManager, JoinRequestManager, SubjectManager } from '../core/circles-manager.js';

// ============================================================
// Estado del módulo
// ============================================================
let allCircles         = [];   // Caché de todos los círculos traídos de Supabase
let userCircles        = [];   // Membresías del usuario (rows de circles_table_student)
let allSubjects        = [];   // Caché de todos los cursos
let activeCourseFilter = 'ALL';
let codeResultCircle   = null; // Círculo encontrado por código (estado temporal)

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

    // Cargar información de círculos privados a los que el usuario pertenece
    if (userCircles.length > 0) {
        const missingCircleIds = userCircles
            .map(uc => uc.id_circle)
            .filter(id => !allCircles.find(c => c.id === id));
            
        for (const id of missingCircleIds) {
            const circle = await CirclesManager.getCircleById(id);
            if (circle) allCircles.push(circle);
        }
    }

    buildCommunityProfileBanner();
    renderFilterTabs();
    renderCirclesStream();
    renderMisCirculos();

    setTimeout(() => {
        const preloader = document.getElementById('app-preloader');
        if (preloader) preloader.classList.add('fade-out-loader');
    }, 350);

    // Revisar si existe el parámetro 'code' en la URL (al ser escaneado por QR)
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');
    if (codeParam) {
        const codeInput = document.getElementById('code-search-input');
        if (codeInput) {
            codeInput.value = codeParam;
            if (typeof window.searchCircleByCode === 'function') {
                window.searchCircleByCode();
            }
        }
    }
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

    const publicCircles = allCircles.filter(c => c.is_public);
    const filtered = activeCourseFilter === 'ALL'
        ? publicCircles
        : publicCircles.filter(c => c.id_theme === activeCourseFilter);

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
        card.onclick = () => openCircleDetailDrawer(circle.id);

        let tagsHtml = '';
        if (circle.tags && circle.tags.length > 0) {
            tagsHtml = circle.tags.map(tId => {
                const t = allSubjects.find(s => s.id === tId);
                if (!t) return '';
                const tColor = getCourseColor(tId);
                return `<span class="circle-course-badge" style="color:${tColor}; background:color-mix(in srgb, ${tColor} 12%, transparent); opacity: 0.8; font-size: 11px;">${t.name}</span>`;
            }).join(' ');
        }

        card.innerHTML = `
            <div class="circle-card-header">
                <div style="display:flex; flex-wrap:wrap; gap:4px;">
                    <span class="circle-course-badge" style="color:${color}; background:color-mix(in srgb, ${color} 12%, transparent)">
                        ${subject?.name || 'General'}
                    </span>
                    ${tagsHtml}
                </div>
                <span class="circle-meta-members">👥 ${circle.number_students ?? 0}</span>
            </div>
            <h3>${circle.name}</h3>
            <p>${circle.description || 'Círculo de estudio colaborativo.'}</p>
            <button
                class="btn-join-circle"
                id="btn-circle-${circle.id}"
                onclick="event.stopPropagation(); toggleCircleMembership('${circle.id}')">
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

        let tagsHtml = '';
        if (circle.tags && circle.tags.length > 0) {
            tagsHtml = circle.tags.map(tId => {
                const t = allSubjects.find(s => s.id === tId);
                if (!t) return '';
                const tColor = getCourseColor(tId);
                return `<span class="mis-circulos-badge" style="color:${tColor}; background:color-mix(in srgb, ${tColor} 12%, transparent); opacity: 0.8;">${t.name}</span>`;
            }).join(' ');
        }

        const item = document.createElement('div');
        item.className = 'mis-circulos-item';
        item.id = `mis-circulos-item-${circle.id}`;
        item.style.cursor = 'pointer';
        item.onclick = () => openCircleDetailDrawer(circle.id);
        item.innerHTML = `
            <div class="mis-circulos-info">
                <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom: 2px;">
                    <span class="mis-circulos-badge" style="color:${color}; background:color-mix(in srgb, ${color} 12%, transparent)">
                        ${subject?.name || 'General'}
                    </span>
                    ${tagsHtml}
                </div>
                <strong class="mis-circulos-name">${circle.name}</strong>
            </div>
            <button
                class="btn-leave-circle ${isOwner ? 'btn-leave-disabled' : ''}"
                onclick="event.stopPropagation(); toggleCircleMembership('${circle.id}')"
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

    const publicCircles = allCircles.filter(c => c.is_public);
    const source = activeCourseFilter === 'ALL'
        ? publicCircles
        : publicCircles.filter(c => c.id_theme === activeCourseFilter);

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
        card.onclick = () => openCircleDetailDrawer(circle.id);
        card.innerHTML = `
            <div class="circle-card-header">
                <span class="circle-course-badge" style="color:${color}; background:color-mix(in srgb, ${color} 12%, transparent)">
                    ${subject?.name || 'General'}
                </span>
                <span class="circle-meta-members">👥 ${circle.number_students ?? 0}</span>
            </div>
            <h3>${circle.name}</h3>
            <p>${circle.description || 'Círculo de estudio colaborativo.'}</p>
            <button class="btn-join-circle" id="btn-circle-${circle.id}" onclick="event.stopPropagation(); toggleCircleMembership('${circle.id}')">
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
        } else {
            alert('No se pudo salir del círculo.');
        }
    } else {
        const membership = await UserCirclesManager.createConectionCircleStudent('member', circleId, userId);
        if (membership) {
            userCircles.push(membership);
            const circle = allCircles.find(c => c.id === circleId);
            if (circle) circle.number_students = (circle.number_students || 0) + 1;
        } else {
            alert('No se pudo unir al círculo. Puede que esté lleno.');
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

    // Poblar el select de materias (principal y tags)
    const select = document.getElementById('modal-circle-theme');
    const tagsSelect = document.getElementById('modal-circle-tags');
    if (select && allSubjects.length) {
        select.innerHTML = `<option value="">— Selecciona una materia —</option>`;
        if (tagsSelect) tagsSelect.innerHTML = '';
        allSubjects.forEach(s => {
            select.innerHTML += `<option value="${s.id}">${s.icon || ''} ${s.name}</option>`;
            if (tagsSelect) tagsSelect.innerHTML += `<option value="${s.id}">${s.icon || ''} ${s.name}</option>`;
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

    const name     = document.getElementById('modal-circle-name')?.value.trim();
    const desc     = document.getElementById('modal-circle-desc')?.value.trim();
    const theme    = document.getElementById('modal-circle-theme')?.value;
    const isPublic = document.getElementById('modal-circle-visibility')?.value !== 'private';
    const maxVal   = document.getElementById('modal-circle-max-members')?.value;
    const maxMembers = maxVal ? parseInt(maxVal, 10) : null;
    
    // Obtener tags
    const tagsSelect = document.getElementById('modal-circle-tags');
    const tags = tagsSelect ? Array.from(tagsSelect.selectedOptions).map(opt => opt.value).filter(val => val !== theme) : [];

    if (!name)  return showModalError('El nombre del círculo es obligatorio.');
    if (!theme) return showModalError('Selecciona una materia para el círculo.');

    // Verificar duplicado por nombre
    const dupes = await CirclesManager.getCirclesByOwnerAndName(userId, name);
    if (dupes && dupes.length) return showModalError('Ya tienes un círculo con ese nombre.');

    const submitBtn = document.getElementById('modal-submit-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Creando...'; }

    const newCircle = await CirclesManager.createCircle(name, desc, theme, userId, isPublic, maxMembers, tags);

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
    const createModal = document.getElementById('create-circle-modal');
    if (createModal && e.target === createModal) closeCreateCircleModal();

    const codeModal = document.getElementById('code-result-modal');
    if (codeModal && e.target === codeModal) closeCodeSearchModal();

    const drawer = document.getElementById('circle-detail-drawer');
    if (drawer && e.target === drawer) closeCircleDetailDrawer();
});

// ============================================================
// Búsqueda por código de círculo
// ============================================================

/**
 * Fuerza mayúsculas y límite de 6 chars en el input de código.
 */
window.onCodeInput = function(input) {
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
};

/**
 * Busca un círculo por su join_code y abre el modal de resultado.
 */
window.searchCircleByCode = async function() {
    const input = document.getElementById('code-search-input');
    const code  = input?.value.trim().toUpperCase();

    if (!code || code.length < 6) {
        showCodeError('Ingresa un código de 6 caracteres.');
        return;
    }

    const searchBtn = document.getElementById('code-search-btn');
    if (searchBtn) { searchBtn.disabled = true; searchBtn.innerText = 'Buscando...'; }

    codeResultCircle = await CirclesManager.getCircleByCode(code);

    if (searchBtn) { searchBtn.disabled = false; searchBtn.innerText = 'Buscar'; }

    if (!codeResultCircle) {
        showCodeError('Código no encontrado. Verifica que esté escrito correctamente.');
        return;
    }

    clearCodeError();
    await openCodeSearchModal();
};

window.openCodeSearchModal = async function() {
    const modal = document.getElementById('code-result-modal');
    if (!modal || !codeResultCircle) return;

    const userId  = window.CurrentUserService?.getId();
    const circle  = codeResultCircle;
    const subject = allSubjects.find(s => s.id === circle.id_theme);
    const color   = getCourseColor(circle.id_theme);

    // Determinar el estado del usuario respecto a este círculo
    const isMember  = userId && userCircles.some(uc => uc.id_circle === circle.id);
    const reqStatus = (userId && !isMember) ? await JoinRequestManager.checkRequest(circle.id, userId) : null;

    // Construir el CTA según estado
    let ctaHtml = '';
    if (!userId) {
        ctaHtml = `<p class="code-result-notice">Inicia sesión para unirte a este círculo.</p>`;
    } else if (isMember) {
        ctaHtml = `<button class="btn-code-action joined" disabled></button>`;
        ctaHtml = `<span class="code-result-notice success">✅ Ya eres miembro de este círculo.</span>`;
    } else if (circle.is_public) {
        ctaHtml = `<button class="btn-code-action" onclick="doJoinByCode()">Unirse al Círculo</button>`;
    } else if (reqStatus === 'pending') {
        ctaHtml = `<span class="code-result-notice pending">⏳ Tu solicitud está en revisión. Espera la respuesta del admin.</span>`;
    } else if (reqStatus === 'rejected') {
        ctaHtml = `
            <span class="code-result-notice warning">❌ Tu solicitud anterior fue rechazada. Puedes volver a intentarlo.</span>
            <div class="code-request-form">
                <textarea id="code-request-message" class="form-input modal-textarea" placeholder="Mensaje para el admin (opcional)" rows="2" maxlength="200"></textarea>
                <button class="btn-code-action" onclick="submitJoinRequest()">Enviar nueva solicitud</button>
            </div>`;
    } else {
        // Círculo privado, sin solicitud previa
        ctaHtml = `
            <div class="code-request-form">
                <p class="code-result-notice"></span>Para unirte necesitas la aprobación del admin.</p>
                <textarea id="code-request-message" class="form-input modal-textarea" placeholder="Mensaje para el admin (opcional)" rows="2" maxlength="200"></textarea>
                <button class="btn-code-action" onclick="submitJoinRequest()">Enviar solicitud de unión</button>
            </div>`;
    }

    document.getElementById('code-result-body').innerHTML = `
        <div class="code-result-card">
            <div class="code-result-header">
                <span class="circle-course-badge" style="color:${color}; background:color-mix(in srgb, ${color} 12%, transparent)">
                    ${subject?.name || 'General'}
                </span>
                <span class="code-visibility-badge ${circle.is_public ? 'public' : 'private'}">
                    ${circle.is_public ? '🌐 Público' : '🔒 Privado'}
                </span>
            </div>
            <h3>${circle.name}</h3>
            <p class="code-result-desc">${circle.description || 'Sin descripción.'}</p>
            <span class="code-result-members">👥 ${circle.number_students ?? 0} miembros</span>
            <div class="code-result-cta">
                ${ctaHtml}
            </div>
        </div>
    `;

    modal.classList.add('open');
};

window.closeCodeSearchModal = function() {
    const modal = document.getElementById('code-result-modal');
    if (modal) modal.classList.remove('open');
};

/**
 * Unión directa para círculos públicos encontrados por código.
 */
window.doJoinByCode = async function() {
    const userId = window.CurrentUserService?.getId();
    if (!userId || !codeResultCircle) return;

    const btn = document.querySelector('.btn-code-action');
    if (btn) { btn.disabled = true; btn.innerText = 'Uniéndote...'; }

    const membership = await UserCirclesManager.createConectionCircleStudent('member', codeResultCircle.id, userId);

    if (!membership) {
        if (btn) { btn.disabled = false; btn.innerText = 'Unirse al Círculo'; }
        return;
    }

    // Actualizar estado local
    userCircles.push(membership);
    const circle = allCircles.find(c => c.id === codeResultCircle.id);
    if (circle) circle.number_students = (circle.number_students || 0) + 1;
    else allCircles.unshift({ ...codeResultCircle, number_students: 1 }); // por si no estaba en caché

    closeCodeSearchModal();
    updateBannerCount();
    renderCirclesStream();
    renderMisCirculos();
    document.getElementById('code-search-input').value = '';
};

/**
 * Envía solicitud de unión para un círculo privado.
 */
window.submitJoinRequest = async function() {
    const userId = window.CurrentUserService?.getId();
    if (!userId || !codeResultCircle) return;

    const message = document.getElementById('code-request-message')?.value.trim() || '';
    const btn     = document.querySelector('.btn-code-action');
    if (btn) { btn.disabled = true; btn.innerText = 'Enviando...'; }

    const request = await JoinRequestManager.sendRequest(codeResultCircle.id, userId, message);

    if (!request) {
        if (btn) { btn.disabled = false; btn.innerText = 'Enviar solicitud de unión'; }
        return;
    }

    // Mostrar confirmación en el modal
    document.getElementById('code-result-body').innerHTML = `
        <div class="code-sent-confirm">
            <span class="code-sent-icon">📬</span>
            <h3>Solicitud enviada</h3>
            <p>El administrador de <strong>${codeResultCircle.name}</strong> revisará tu solicitud y recibirás una notificación con su respuesta.</p>
            <button class="btn-code-action" onclick="closeCodeSearchModal()">Entendido</button>
        </div>
    `;
};

function showCodeError(msg) {
    const el = document.getElementById('code-search-error');
    if (el) { el.innerText = msg; el.style.display = 'block'; }
}
function clearCodeError() {
    const el = document.getElementById('code-search-error');
    if (el) { el.innerText = ''; el.style.display = 'none'; }
}

// ============================================================
// Drawer — Detalle de Círculo
// ============================================================

window.openCircleDetailDrawer = async function(circleId) {
    const circle = allCircles.find(c => c.id === circleId);
    if (!circle) return;

    const drawer = document.getElementById('circle-detail-drawer');
    if (!drawer) return;
    
    // Resetear a la pestaña Info
    if (window.switchDrawerTab) window.switchDrawerTab('info');

    const userId  = window.CurrentUserService?.getId();
    const subject = allSubjects.find(s => s.id === circle.id_theme);
    const color   = getCourseColor(circle.id_theme);
    const role    = userId ? await UserCirclesManager.getUserRole(circle.id, userId) : null;
    const isMember = !!role;
    const isAdmin  = role === 'admin';

    // 1. Header & Body
    let tagsHtml = '';
    if (circle.tags && circle.tags.length > 0) {
        tagsHtml = circle.tags.map(tId => {
            const t = allSubjects.find(s => s.id === tId);
            if (!t) return '';
            const tColor = getCourseColor(tId);
            return `<span class="circle-course-badge" style="color:${tColor}; background:color-mix(in srgb, ${tColor} 12%, transparent); opacity: 0.8; font-size: 11px;">${t.name}</span>`;
        }).join(' ');
    }

    document.getElementById('drawer-header-content').innerHTML = `
        <span class="code-visibility-badge ${circle.is_public ? 'public' : 'private'}">${circle.is_public ? '🌐 Público' : '🔒 Privado'}</span>
        <span class="circle-course-badge" style="color:${color}; background:color-mix(in srgb, ${color} 12%, transparent)">${subject?.name || 'General'}</span>
        ${tagsHtml}
    `;

    document.getElementById('drawer-body-content').innerHTML = `
        <h2>${circle.name}</h2>
        <p id="circle-desc-text-${circle.id}">${circle.description || 'Sin descripción.'}</p>
        ${isAdmin ? `<button onclick="editCircleDescription('${circle.id}')" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:12px;margin-bottom:10px;padding:0;">✎ Editar descripción</button>` : ''}
        <div class="drawer-stats">
            <span>📅 Creado el ${new Date(circle.created_at).toLocaleDateString()}</span>
            ${isAdmin && circle.join_code ? `
            <span title="Código de acceso" style="display:flex; align-items:center; gap:8px;">
                🔑 Código: <strong>${circle.join_code}</strong>
                <button class="btn-action-icon" style="width:24px;height:24px;" title="Generar QR" onclick="openQRModal('${circle.join_code}', '${circle.name}')">📱</button>
            </span>` : ''}
        </div>
    `;

    // 2. Panel de admin (solicitudes pendientes)
    const adminPanel = document.getElementById('drawer-admin-panel');
    const pendingList = document.getElementById('drawer-pending-list');
    
    if (isAdmin && !circle.is_public) {
        adminPanel.style.display = 'block';
        pendingList.innerHTML = '<p style="font-size:12px;color:var(--muted);">Cargando...</p>';
        const requests = await JoinRequestManager.getPendingRequests(circle.id) || [];
        
        document.getElementById('drawer-pending-count').innerText = requests.length;
        
        if (requests.length === 0) {
            pendingList.innerHTML = '<p style="font-size:12px;color:var(--muted);">No hay solicitudes pendientes.</p>';
        } else {
            pendingList.innerHTML = requests.map(req => `
                <div class="user-row" id="req-row-${req.id}">
                    <div class="user-row-avatar" style="background-image:url(${req.avatar_url})"></div>
                    <div class="user-row-info">
                        <span class="user-row-name">${req.name}</span>
                        <span class="user-row-role" title="${req.message || ''}">${req.message ? `💬 "${req.message}"` : 'Sin mensaje'}</span>
                    </div>
                    <div class="user-row-actions">
                        <button class="btn-action-icon approve" onclick="approveDrawerRequest('${req.id}', '${circle.id}')" title="Aprobar">✓</button>
                        <button class="btn-action-icon reject" onclick="rejectDrawerRequest('${req.id}', '${circle.id}')" title="Rechazar">✕</button>
                    </div>
                </div>
            `).join('');
        }
    } else {
        adminPanel.style.display = 'none';
    }

    // 3. Miembros
    const membersList = document.getElementById('drawer-members-list');
    membersList.innerHTML = '<p style="font-size:12px;color:var(--muted);">Cargando miembros...</p>';
    
    const members = await CirclesManager.getCircleMembers(circle.id) || [];
    document.getElementById('drawer-members-count').innerText = members.length;
    
    membersList.innerHTML = members.map(m => `
        <div class="user-row">
            <div class="user-row-avatar" style="background-image:url(${m.avatar_url})"></div>
            <div class="user-row-info">
                <span class="user-row-name">${m.name} ${m.id_student === userId ? '(Tú)' : ''}</span>
                <span class="user-row-role ${m.role === 'admin' ? 'admin' : ''}">${m.role === 'admin' ? 'Administrador' : 'Estudiante'}</span>
            </div>
            ${(isAdmin && m.id_student !== userId) ? `
            <div class="user-row-actions">
                ${m.role !== 'admin' ? `<button class="btn-action-icon approve" onclick="promoteDrawerMember('${circle.id}', '${m.id_student}')" title="Hacer administrador">⭐</button>` : ''}
                <button class="btn-action-icon reject" onclick="kickDrawerMember('${circle.id}', '${m.id_student}')" title="Expulsar del círculo">👢</button>
            </div>` : ''}
        </div>
    `).join('');

    // 4. Ranking
    const rankingList = document.getElementById('drawer-ranking-list');
    const sortedMembers = [...members].sort((a, b) => (b.total_xp || 0) - (a.total_xp || 0));
    
    rankingList.innerHTML = sortedMembers.map((m, i) => `
        <div class="ranking-row top-${i + 1}">
            <div class="ranking-pos">${i + 1}</div>
            <div class="user-row-avatar" style="background-image:url(${m.avatar_url}); width:32px; height:32px;"></div>
            <div class="user-row-info" style="flex:1;">
                <span class="user-row-name" style="font-size:13px; font-weight: 600;">${m.name} ${m.id_student === userId ? '(Tú)' : ''}</span>
            </div>
            <div class="ranking-xp">${m.total_xp || 0} XP</div>
        </div>
    `).join('');

    // 5. Footer CTA
    const footer = document.getElementById('drawer-footer-cta');
    const reqStatus = (userId && !isMember) ? await JoinRequestManager.checkRequest(circle.id, userId) : null;
    
    if (!userId) {
        footer.innerHTML = `<button class="btn-code-action joined" disabled>Inicia sesión para unirte</button>`;
    } else if (isAdmin) {
        footer.innerHTML = `<button class="btn-code-action joined" disabled>Eres el administrador</button>`;
    } else if (isMember) {
        footer.innerHTML = `<button class="btn-code-action" style="background:var(--error-bg);color:var(--red-err);" onclick="toggleCircleMembership('${circle.id}'); closeCircleDetailDrawer();">Salir del Círculo</button>`;
    } else if (circle.is_public) {
        footer.innerHTML = `<button class="btn-code-action" onclick="toggleCircleMembership('${circle.id}'); closeCircleDetailDrawer();">Unirse al Círculo</button>`;
    } else if (reqStatus === 'pending') {
        footer.innerHTML = `<button class="btn-code-action joined" disabled>⏳ Solicitud en revisión</button>`;
    } else {
        footer.innerHTML = `<button class="btn-code-action" onclick="codeResultCircle = allCircles.find(c => c.id === '${circle.id}'); submitJoinRequest(); closeCircleDetailDrawer();">Enviar solicitud de unión</button>`;
    }

    drawer.classList.add('open');
};

window.switchDrawerTab = function(tabName) {
    document.getElementById('btn-tab-info').classList.toggle('active', tabName === 'info');
    document.getElementById('btn-tab-ranking').classList.toggle('active', tabName === 'ranking');
    document.getElementById('drawer-tab-info').style.display = tabName === 'info' ? 'block' : 'none';
    document.getElementById('drawer-tab-ranking').style.display = tabName === 'ranking' ? 'block' : 'none';
};

window.closeCircleDetailDrawer = function() {
    const drawer = document.getElementById('circle-detail-drawer');
    if (drawer) drawer.classList.remove('open');
};

window.approveDrawerRequest = async function(reqId, circleId) {
    const btnApprove = document.querySelector(`#req-row-${reqId} .approve`);
    if (btnApprove) btnApprove.disabled = true;
    
    const ok = await JoinRequestManager.approveRequest(reqId);
    if (ok) {
        // Refrescar el drawer silenciosamente
        openCircleDetailDrawer(circleId);
    } else {
        if (btnApprove) btnApprove.disabled = false;
        alert('Error al aprobar solicitud');
    }
};

window.rejectDrawerRequest = async function(reqId, circleId) {
    const btnReject = document.querySelector(`#req-row-${reqId} .reject`);
    if (btnReject) btnReject.disabled = true;
    
    const ok = await JoinRequestManager.rejectRequest(reqId);
    if (ok) {
        openCircleDetailDrawer(circleId);
    } else {
        if (btnReject) btnReject.disabled = false;
        alert('Error al rechazar solicitud');
    }
};

window.editCircleDescription = async function(circleId) {
    const newDesc = prompt("Ingresa la nueva descripción del círculo:");
    if (newDesc !== null) {
        const ok = await CirclesManager.updateCircleDesc(circleId, newDesc);
        if (ok) {
            const circle = allCircles.find(c => c.id === circleId);
            if (circle) circle.description = newDesc;
            openCircleDetailDrawer(circleId); // Refresh
        } else {
            alert('Error al actualizar la descripción');
        }
    }
};

window.promoteDrawerMember = async function(circleId, studentId) {
    if (!confirm('¿Estás seguro de ascender a este miembro a Administrador?')) return;
    const ok = await UserCirclesManager.updateRoleCircleStudent(circleId, studentId, 'admin');
    if (ok) {
        openCircleDetailDrawer(circleId); // Refresh
    } else {
        alert('Error al ascender al miembro');
    }
};

window.kickDrawerMember = async function(circleId, studentId) {
    if (!confirm('¿Estás seguro de expulsar a este miembro del círculo?')) return;
    const ok = await UserCirclesManager.leaveCircle(circleId, studentId);
    if (ok) {
        openCircleDetailDrawer(circleId); // Refresh
    } else {
        alert('Error al expulsar al miembro');
    }
};

// ============================================================
// QR Modal
// ============================================================
window.openQRModal = function(code, circleName) {
    const modal = document.getElementById('qr-modal');
    if (!modal) return;
    
    document.getElementById('qr-modal-title').innerText = circleName;
    document.getElementById('qr-modal-code').innerText = code;
    
    // Generar imagen del QR con API gratuita apuntando a la URL completa
    const baseUrl = window.location.origin + window.location.pathname;
    const fullUrl = `${baseUrl}?code=${code}`;
    
    const qrImage = document.getElementById('qr-image');
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(fullUrl)}&format=svg`;
    
    modal.classList.add('open');
};

window.closeQRModal = function() {
    const modal = document.getElementById('qr-modal');
    if (modal) modal.classList.remove('open');
};

document.addEventListener('click', (e) => {
    const qrModal = document.getElementById('qr-modal');
    if (qrModal && e.target === qrModal) closeQRModal();
});