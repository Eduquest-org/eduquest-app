import { ResourcesManager } from '../core/resources-manager.js';
import { CoursesManager }   from '../core/courses-manager.js';

// === TOGGLE DROPDOWN DE CURSOS ===
function setCourseDropdown(open) {
    const wrapper = document.getElementById("course-dropdown-wrapper");
    if (wrapper) wrapper.classList.toggle("open", open);
}

window.toggleCourseDropdown = function() {
    const wrapper = document.getElementById("course-dropdown-wrapper");
    if (wrapper) wrapper.classList.toggle("open");
};

// Cerrar dropdown al hacer clic fuera
document.addEventListener("click", e => {
    const wrapper = document.getElementById("course-dropdown-wrapper");
    if (wrapper && !wrapper.contains(e.target)) {
        wrapper.classList.remove("open");
    }
});

// === ESTADO GLOBAL ===
const state = {
    page:     1,
    total:    0,
    filter:   'todos',
    courseId: null,
    search:   ''
};

const PAGE_SIZE = 15;

const TYPE_ICONS = {
    leccion:       '🎥',
    recurso:       '📄',
    quiz:          '🧠',
    examen:        '📝',
    desafio_final: '🏆'
};
const TYPE_LABELS = {
    leccion:       'Ver video',
    recurso:       'Ver lectura',
    quiz:          'Hacer quiz',
    examen:        'Hacer examen',
    desafio_final: 'Desafío'
};

// === INIT ===
document.addEventListener("DOMContentLoaded", async () => {
    if (window.CurrentUserService && typeof CurrentUserService.init === 'function') {
        await CurrentUserService.init();
    }
    setupSearch();
    await Promise.all([
        loadStats(),
        loadCourseFilters()
    ]);
    await fetchAndRender();
});

// === BÚSQUEDA (debounced 350ms) ===
function setupSearch() {
    const input = document.getElementById("resources-search");
    if (!input) return;
    let timer;
    input.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            state.search = input.value.trim();
            state.page   = 1;
            await fetchAndRender();
        }, 350);
    });
}

// === FILTROS DE CURSO (carga dinámica) ===
async function loadCourseFilters() {
    const container = document.getElementById("course-filters");
    if (!container) return;

    try {
        const courses = await CoursesManager.getCourses();
        container.innerHTML = "";

        // Botón "Todos los cursos" (por defecto activo)
        const allBtn = makeCourseChip("Todos los cursos", null, null, true);
        container.appendChild(allBtn);

        courses.forEach(course => {
            const btn = makeCourseChip(
                `${course.icon || '📚'} ${course.name}`,
                course.id,
                course.color
            );
            container.appendChild(btn);
        });
    } catch (e) {
        console.error("[Resources] Error cargando cursos:", e);
    }
}

function makeCourseChip(label, courseId, color, active = false) {
    const btn = document.createElement("button");
    btn.className   = "course-chip" + (active ? " active" : "");
    btn.textContent = label;

    if (color && !active) {
        btn.style.setProperty('--chip-color', color);
    }

    btn.onclick = async () => {
        document.querySelectorAll(".course-chip").forEach(c => {
            c.classList.remove("active");
            c.style.removeProperty('background');
            c.style.removeProperty('color');
            c.style.removeProperty('border-color');
            c.style.removeProperty('box-shadow');
        });
        btn.classList.add("active");

        if (color) {
            btn.style.background   = color;
            btn.style.color        = '#fff';
            btn.style.borderColor  = color;
            btn.style.boxShadow    = `0 3px 10px ${color}45`;
        }

        // Actualizar label del botón desplegable
        const nameEl = document.getElementById("course-selected-name");
        if (nameEl) nameEl.textContent = courseId ? label : "Todos los cursos";

        // Cerrar el dropdown
        setCourseDropdown(false);

        state.courseId = courseId;
        state.page     = 1;
        await fetchAndRender();
    };

    return btn;
}

// === STATS ===
async function loadStats() {
    try {
        const counts = await ResourcesManager.getStatsCounts();
        setText('stat-videos',   counts.videos);
        setText('stat-lecturas', counts.lecturas);
        setText('stat-quizzes',  counts.evaluaciones);
        setText('stat-total',    counts.total);
    } catch (e) {
        console.error("[Resources] Error cargando stats:", e);
    }
}

// === FETCH + RENDER ===
async function fetchAndRender() {
    const grid = document.getElementById("resources-grid");
    grid.innerHTML = `
        <div class="resources-empty">
            <span class="resources-empty-icon">⏳</span>
            <p>Cargando recursos...</p>
        </div>`;
    hidePagination();

    try {
        const { data, totalCount } = await ResourcesManager.getResources({
            page:       state.page,
            search:     state.search,
            filterType: state.filter,
            courseId:   state.courseId
        });

        state.total = totalCount;
        renderCards(data);
        renderPagination(totalCount);
    } catch (err) {
        console.error("[Resources]", err);
        grid.innerHTML = `
            <div class="resources-empty">
                <span class="resources-empty-icon">⚠️</span>
                <p>Error al cargar los recursos. Intenta de nuevo.</p>
            </div>`;
    }
}

// === RENDER TARJETAS ===
function renderCards(list) {
    const grid = document.getElementById("resources-grid");
    grid.innerHTML = "";

    if (!list.length) {
        const hint = state.search
            ? ` para "<strong>${state.search}</strong>"`
            : state.courseId ? " en este curso" : "";
        grid.innerHTML = `
            <div class="resources-empty">
                <span class="resources-empty-icon">🔍</span>
                <p>No se encontraron recursos${hint}.</p>
            </div>`;
        return;
    }

    list.forEach(res => {
        const card = document.createElement("div");
        card.className = "resource-card";

        const courseColor = res.courses?.color || '#1D9E75';
        const courseIcon  = res.courses?.icon  || '📚';
        const courseName  = res.courses?.name  || 'General';
        const topicName   = res.topics?.name   || 'Sin tema';
        const typeIcon    = TYPE_ICONS[res.type]  || '📄';
        const typeLabel   = TYPE_LABELS[res.type] || 'Ver recurso';

        card.innerHTML = `
            <div class="resource-card-header">
                <div class="resource-course-tag"
                     style="background-color:${courseColor}18;color:${courseColor};border:1px solid ${courseColor}30;">
                    <span>${courseIcon}</span> ${courseName}
                </div>
                <div class="resource-type-badge">${typeIcon}</div>
            </div>
            <div class="resource-title">${res.title}</div>
            <div class="resource-topic">${topicName}</div>
            <div class="resource-action">
                <span class="resource-action-label">${typeLabel} →</span>
                <span class="resource-action-arrow">→</span>
            </div>
        `;
        card.onclick = () => openResourceModal(res);
        grid.appendChild(card);
    });
}

// === FILTROS (expuestos al HTML) ===
window.filterResources = async function(filterKey, buttonEl) {
    document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
    buttonEl.classList.add("active");
    state.filter = filterKey;
    state.page   = 1;
    await fetchAndRender();
};

// === PAGINACIÓN ===
function renderPagination(totalCount) {
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const container  = document.getElementById("resources-pagination");
    if (!container) return;

    if (totalPages <= 1) { hidePagination(); return; }

    container.style.display = "flex";
    container.innerHTML     = "";

    const cur = state.page;

    container.appendChild(makePagBtn("← Anterior", cur === 1, () => goToPage(cur - 1)));

    buildPageRange(cur, totalPages).forEach(p => {
        if (p === '…') {
            const dot = document.createElement("span");
            dot.className = "pag-ellipsis";
            dot.textContent = "…";
            container.appendChild(dot);
        } else {
            const btn = makePagBtn(p, false, () => goToPage(p));
            if (p === cur) btn.classList.add("active");
            container.appendChild(btn);
        }
    });

    container.appendChild(makePagBtn("Siguiente →", cur === totalPages, () => goToPage(cur + 1)));

    const from = (cur - 1) * PAGE_SIZE + 1;
    const to   = Math.min(cur * PAGE_SIZE, totalCount);
    setText("pagination-info", `Mostrando ${from}–${to} de ${totalCount} recursos`);
}

function buildPageRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set([1, total, current]);
    if (current > 1) pages.add(current - 1);
    if (current < total) pages.add(current + 1);
    const sorted = [...pages].sort((a, b) => a - b);
    const result = [];
    let prev = 0;
    sorted.forEach(p => {
        if (p - prev > 1) result.push('…');
        result.push(p);
        prev = p;
    });
    return result;
}

function makePagBtn(label, disabled, onClick) {
    const btn = document.createElement("button");
    btn.className   = "pag-btn";
    btn.textContent = label;
    btn.disabled    = disabled;
    if (!disabled) btn.onclick = onClick;
    return btn;
}

async function goToPage(page) {
    state.page = page;
    await fetchAndRender();
    document.getElementById("resources-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hidePagination() {
    const c = document.getElementById("resources-pagination");
    if (c) c.style.display = "none";
    setText("pagination-info", "");
}

// === MODAL ===
function openResourceModal(resource) {
    let finalUrl = resource.url || "";
    if (finalUrl.includes("youtube.com/watch?v=")) {
        const vid = finalUrl.split("v=")[1].split("&")[0];
        finalUrl  = `https://www.youtube.com/embed/${vid}?autoplay=1`;
    } else if (finalUrl.includes("youtu.be/")) {
        const vid = finalUrl.split("youtu.be/")[1].split("?")[0];
        finalUrl  = `https://www.youtube.com/embed/${vid}?autoplay=1`;
    }

    let modal = document.getElementById("resource-modal-overlay");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "resource-modal-overlay";
        modal.className = "resource-modal-overlay";
        modal.innerHTML = `
            <div class="resource-modal-content">
                <div class="resource-modal-header">
                    <h3 id="modal-resource-title">Recurso</h3>
                    <button class="resource-modal-close" onclick="closeResourceModal()">✕</button>
                </div>
                <div class="resource-modal-body">
                    <iframe id="resource-iframe" class="resource-modal-iframe"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen></iframe>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) closeResourceModal(); });
    }
    document.getElementById("modal-resource-title").innerText = resource.title;
    document.getElementById("resource-iframe").src = finalUrl;
    modal.style.display = "flex";
}

window.closeResourceModal = function() {
    const modal = document.getElementById("resource-modal-overlay");
    if (modal) {
        modal.style.display = "none";
        document.getElementById("resource-iframe").src = "";
    }
};

// === UTILS ===
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}
