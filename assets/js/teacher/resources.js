// ==========================================================================
// assets/js/teacher/resources.js
// PANEL DOCENTE · Biblioteca de recursos (PDFs, videos, lecturas)
// ==========================================================================
// CRUD completo sobre la tabla `resources` y el bucket de Storage
// "eduquest-docs" (PDFs). Reutiliza TeacherUI para modales/toasts.
//
// Integración RAG: al crear/editar un recurso se indexa automáticamente en
// Pinecone via el backend (/api/index-resource). Al eliminarlo se borra
// el vector correspondiente. Ambas operaciones son fire-and-forget —
// el docente no espera a que Pinecone confirme.
// ==========================================================================

/** URL del backend de EduQuest. Detecta automáticamente el entorno. */
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : 'https://eduquest-backend-delta.vercel.app';

/**
 * Obtiene el JWT de la sesión activa de Supabase para autenticar llamadas al backend.
 * @returns {Promise<string|null>} Token JWT o null si no hay sesión.
 */
async function getAuthToken() {
  try {
    const { data } = await window.supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Envía los metadatos de un recurso al backend para indexarlo en Pinecone (RAG).
 * Fire-and-forget — los errores se logean pero no bloquean la UI.
 *
 * @param {{ id, title, type, courseId, topicId, description, url }} resource
 */
async function indexResourceInRAG(resource) {
  try {
    const token = await getAuthToken();
    if (!token) { console.warn('[RAG] Sin sesión activa — recurso no indexado.'); return; }

    const resp = await fetch(`${BACKEND_URL}/api/index-resource`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify(resource)
    });
    if (resp.ok) {
      console.log(`[RAG] ✅ Recurso ${resource.id} indexado en Pinecone.`);
    } else {
      const err = await resp.json().catch(() => ({}));
      console.warn(`[RAG] ⚠️ Error indexando recurso: ${err.error || resp.status}`);
    }
  } catch (err) {
    console.warn('[RAG] Error de red al indexar recurso:', err.message);
  }
}

/**
 * Elimina el vector de un recurso en Pinecone cuando el docente lo borra.
 * Fire-and-forget — los errores se logean pero no bloquean la UI.
 *
 * @param {string} resourceId - ID del recurso a eliminar de Pinecone.
 */
async function deleteResourceFromRAG(resourceId) {
  try {
    const token = await getAuthToken();
    if (!token) { console.warn('[RAG] Sin sesión activa — vector no eliminado.'); return; }

    const resp = await fetch(`${BACKEND_URL}/api/index-resource`, {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify({ id: resourceId })
    });
    if (resp.ok) {
      console.log(`[RAG] 🗑️ Vector ${resourceId} eliminado de Pinecone.`);
    } else {
      const err = await resp.json().catch(() => ({}));
      console.warn(`[RAG] ⚠️ Error eliminando vector: ${err.error || resp.status}`);
    }
  } catch (err) {
    console.warn('[RAG] Error de red al eliminar vector:', err.message);
  }
}

import { ResourcesManager } from '../core/resources-manager.js';
import { CoursesManager } from '../core/courses-manager.js';
import { TopicsManager } from '../core/topics-manager.js';

const TYPE_ICONS = {
  leccion: '🎥',
  recurso: '📄',
};
const TYPE_LABELS = {
  leccion: 'Video',
  recurso: 'Lectura / PDF',
};

const MAX_PDF_MB = 20;

const state = {
  all: [],
  courses: [],
  topicsByCourse: new Map(),
  search: '',
  type: 'todos',
  courseId: '',
  editingId: null,
  selectedFile: null,
  source: 'link',
  pendingDeleteId: null,
};

document.addEventListener('DOMContentLoaded', async () => {
  if (window.CurrentUserService && typeof CurrentUserService.init === 'function') {
    await CurrentUserService.init();
  }

  wireToolbar();
  wireModal();
  wireDeleteModal();

  await loadCourses();
  await loadResources();
});

// ─── Carga de datos ─────────────────────────────────────────────────────
async function loadCourses() {
  state.courses = await CoursesManager.getCourses();

  const filterSelect = document.getElementById('resCourseFilter');
  const modalSelect = document.getElementById('resourceCourse');

  const options = state.courses
    .map((c) => `<option value="${c.id}">${c.icon || '📚'} ${escapeHtml(c.name)}</option>`)
    .join('');

  if (filterSelect) filterSelect.insertAdjacentHTML('beforeend', options);
  if (modalSelect) modalSelect.insertAdjacentHTML('beforeend', options);
}

async function loadResources() {
  const grid = document.getElementById('resGrid');
  if (grid) grid.innerHTML = '<p class="res-loading">Cargando recursos…</p>';

  try {
    state.all = await ResourcesManager.getResourcesForTeacher({});
    renderStats();
    applyFilters();
  } catch (err) {
    console.error('[teacher/resources] Error cargando recursos:', err);
    if (grid) grid.innerHTML = '<p class="res-loading">No se pudieron cargar los recursos.</p>';
  }
}

function renderStats() {
  const pdfs = state.all.filter((r) => r.type === 'recurso' && (r.url || '').includes('/eduquest-docs/')).length;
  const videos = state.all.filter((r) => r.type === 'leccion').length;
  const readings = state.all.filter((r) => r.type === 'recurso').length;
  const total = state.all.length;

  setText('kpiPdfs', pdfs.toLocaleString('es-PE'));
  setText('kpiVideos', videos.toLocaleString('es-PE'));
  setText('kpiReadings', readings.toLocaleString('es-PE'));
  setText('kpiTotal', total.toLocaleString('es-PE'));
}

// ─── Filtros y búsqueda ─────────────────────────────────────────────────
function wireToolbar() {
  const search = document.getElementById('resSearch');
  let timer;
  search?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.search = search.value.trim().toLowerCase();
      applyFilters();
    }, 300);
  });

  const courseFilter = document.getElementById('resCourseFilter');
  courseFilter?.addEventListener('change', () => {
    state.courseId = courseFilter.value;
    applyFilters();
  });

  document.getElementById('resTypeChips')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    document.querySelectorAll('#resTypeChips .chip').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    state.type = btn.dataset.type;
    applyFilters();
  });

  document.getElementById('btnAddResource')?.addEventListener('click', () => openResourceModal());
  document.getElementById('btnAddResourceEmpty')?.addEventListener('click', () => openResourceModal());
}

function applyFilters() {
  const list = state.all.filter((r) => {
    if (state.type !== 'todos' && r.type !== state.type) return false;
    if (state.courseId && r.course_id !== state.courseId) return false;
    if (state.search && !String(r.title || '').toLowerCase().includes(state.search)) return false;
    if (['quiz', 'examen', 'desafio_final'].includes(r.type)) return false;
    return true;
  });
  renderGrid(list);
}

// ─── Render de la grilla ────────────────────────────────────────────────
function renderGrid(list) {
  const grid = document.getElementById('resGrid');
  const empty = document.getElementById('resEmpty');
  if (!grid) return;

  if (!list.length) {
    grid.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  grid.innerHTML = list.map(renderCard).join('');

  grid.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const resource = state.all.find((r) => r.id === btn.dataset.edit);
      if (resource) openResourceModal(resource);
    });
  });
  grid.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.delete));
  });
}

function renderCard(res) {
  const type = res.type || 'recurso';
  const courseColor = res.courses?.color || 'var(--brand)';
  const courseIcon = res.courses?.icon || '📚';
  const courseName = res.courses?.name || 'Sin curso';
  const topicName = res.topics?.name || 'Sin tema';
  const isPdf = type === 'recurso' && (res.url || '').includes('/eduquest-docs/');

  const openLink = res.url
    ? `<a class="res-open-link" href="${escapeAttr(res.url)}" target="_blank" rel="noopener">
         Abrir <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
       </a>`
    : '<span class="res-open-link" style="color:var(--muted);">Sin enlace</span>';

  return `
    <article class="res-card">
      <div class="res-card-top">
        <span class="res-type-badge type-${type}">${TYPE_ICONS[type] || '📄'} ${TYPE_LABELS[type] || type}</span>
        <div class="res-card-actions">
          <button class="res-icon-btn" data-edit="${escapeAttr(res.id)}" title="Editar" aria-label="Editar recurso">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
          </button>
          <button class="res-icon-btn danger" data-delete="${escapeAttr(res.id)}" title="Eliminar" aria-label="Eliminar recurso">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      <div class="res-card-title">${escapeHtml(res.title)}</div>
      ${res.description ? `<div class="res-card-desc">${escapeHtml(res.description)}</div>` : ''}
      <div class="res-card-tags">
        <span class="res-course-tag" style="background:${courseColor}18;color:${courseColor};border:1px solid ${courseColor}30;">${courseIcon} ${escapeHtml(courseName)}</span>
        <span class="res-topic-tag">${escapeHtml(topicName)}</span>
      </div>
      <div class="res-card-footer">
        ${openLink}
        ${isPdf ? '<span class="res-pdf-flag">📄 PDF alojado</span>' : ''}
      </div>
    </article>
  `;
}

// ─── Modal: crear / editar ──────────────────────────────────────────────
function wireModal() {
  const overlay = document.getElementById('modal-resource');
  if (!overlay) return;
  window.TeacherUI?.wireModal('modal-resource');

  document.getElementById('resourceType')?.addEventListener('change', updateModalFieldsVisibility);

  document.getElementById('resourceCourse')?.addEventListener('change', async (e) => {
    await populateTopicSelect(e.target.value);
  });

  document.querySelectorAll('#resourceSourceField .type-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#resourceSourceField .type-option').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.source = btn.dataset.source;
      updateSourceFieldsVisibility();
    });
  });

  const fileDrop = document.getElementById('resourceFileDrop');
  const fileInput = document.getElementById('resourceFile');
  fileDrop?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) setSelectedFile(file);
  });
  fileDrop?.addEventListener('dragover', (e) => { e.preventDefault(); fileDrop.classList.add('dragover'); });
  fileDrop?.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
  fileDrop?.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDrop.classList.remove('dragover');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  });

  document.getElementById('resourceForm')?.addEventListener('submit', handleSubmit);
}

function setSelectedFile(file) {
  if (file.type !== 'application/pdf') {
    window.TeacherUI?.toast('Solo se permiten archivos PDF.', 'error');
    return;
  }
  if (file.size > MAX_PDF_MB * 1024 * 1024) {
    window.TeacherUI?.toast(`El PDF supera los ${MAX_PDF_MB} MB.`, 'error');
    return;
  }
  state.selectedFile = file;
  setText('resourceFileName', file.name);
}

async function populateTopicSelect(courseId, selectedTopicId = '') {
  const select = document.getElementById('resourceTopic');
  if (!select) return;

  if (!courseId) {
    select.innerHTML = '<option value="">Primero selecciona un curso</option>';
    select.disabled = true;
    return;
  }

  select.disabled = true;
  select.innerHTML = '<option value="">Cargando temas…</option>';

  if (!state.topicsByCourse.has(courseId)) {
    const topics = await TopicsManager.getTopicsByCourse(courseId);
    state.topicsByCourse.set(courseId, topics);
  }
  const topics = state.topicsByCourse.get(courseId) || [];

  select.innerHTML = '<option value="">Selecciona un tema</option>' +
    topics.map((t) => `<option value="${t.id}" ${t.id === selectedTopicId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');
  select.disabled = false;
}

function updateModalFieldsVisibility() {
  const type = document.getElementById('resourceType')?.value;
  const sourceField = document.getElementById('resourceSourceField');
  const isRecurso = type === 'recurso';

  if (sourceField) sourceField.classList.toggle('hidden', !isRecurso);
  updateSourceFieldsVisibility();
}

function updateSourceFieldsVisibility() {
  const type = document.getElementById('resourceType')?.value;
  const urlField = document.getElementById('resourceUrlField');
  const fileField = document.getElementById('resourceFileField');
  const urlInput = document.getElementById('resourceUrl');

  const showFile = type === 'recurso' && state.source === 'pdf';

  if (fileField) fileField.classList.toggle('hidden', !showFile);
  if (urlField) urlField.classList.toggle('hidden', showFile);
  if (urlInput) urlInput.required = !showFile;
}

function resetForm() {
  const form = document.getElementById('resourceForm');
  form?.reset();
  window.TeacherUI?.clearFieldErrors(form);

  state.editingId = null;
  state.selectedFile = null;
  state.source = 'link';

  setText('resourceFileName', '');
  document.getElementById('resourceId').value = '';
  document.getElementById('resourceTopic').innerHTML = '<option value="">Primero selecciona un curso</option>';
  document.getElementById('resourceTopic').disabled = true;

  document.querySelectorAll('#resourceSourceField .type-option').forEach((b) => b.classList.remove('active'));
  document.querySelector('#resourceSourceField .type-option[data-source="link"]')?.classList.add('active');

  updateModalFieldsVisibility();
}

async function openResourceModal(resource = null) {
  resetForm();

  const titleEl = document.getElementById('resourceModalTitle');
  const submitBtn = document.getElementById('resourceSubmitBtn');

  if (resource) {
    state.editingId = resource.id;
    if (titleEl) titleEl.textContent = 'Editar recurso';
    if (submitBtn) submitBtn.textContent = 'Guardar cambios';

    document.getElementById('resourceId').value = resource.id;
    document.getElementById('resourceTitle').value = resource.title || '';
    document.getElementById('resourceType').value = resource.type || 'recurso';
    document.getElementById('resourceCourse').value = resource.course_id || '';
    document.getElementById('resourceUrl').value = resource.url || '';
    document.getElementById('resourceDescription').value = resource.description || '';

    if (resource.course_id) {
      await populateTopicSelect(resource.course_id, resource.topic_id);
    }

    const isPdf = resource.type === 'recurso' && (resource.url || '').includes('/eduquest-docs/');
    if (isPdf) {
      state.source = 'pdf';
      document.querySelectorAll('#resourceSourceField .type-option').forEach((b) => b.classList.remove('active'));
      document.querySelector('#resourceSourceField .type-option[data-source="pdf"]')?.classList.add('active');
      setText('resourceFileName', 'PDF actual conservado (sube otro para reemplazarlo)');
    }

    updateModalFieldsVisibility();
  } else {
    if (titleEl) titleEl.textContent = 'Añadir recurso';
    if (submitBtn) submitBtn.textContent = 'Guardar recurso';
    updateModalFieldsVisibility();
  }

  window.TeacherUI?.openModal('modal-resource');
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  window.TeacherUI?.clearFieldErrors(form);

  const title = document.getElementById('resourceTitle').value.trim();
  const type = document.getElementById('resourceType').value;
  const courseId = document.getElementById('resourceCourse').value;
  const topicId = document.getElementById('resourceTopic').value;
  const description = document.getElementById('resourceDescription').value.trim();
  let url = document.getElementById('resourceUrl').value.trim();

  const errors = {};
  if (!title) errors.title = 'El título es obligatorio.';
  if (!type) errors.type = 'Selecciona un tipo.';
  if (!courseId) errors.course = 'Selecciona un curso.';
  if (!topicId) errors.topic = 'Selecciona un tema.';

  const needsFile = type === 'recurso' && state.source === 'pdf';
  const isEditingWithExistingPdf = state.editingId && needsFile && !state.selectedFile;

  if (needsFile && !state.selectedFile && !isEditingWithExistingPdf) {
    errors.file = 'Selecciona un archivo PDF.';
  }
  if (!needsFile && !url) {
    errors.url = 'La URL es obligatoria para este tipo de recurso.';
  }

  if (Object.keys(errors).length) {
    window.TeacherUI?.showFieldErrors(form, errors);
    return;
  }

  const submitBtn = document.getElementById('resourceSubmitBtn');
  if (submitBtn) submitBtn.disabled = true;

  try {
    let previousUrl = null;
    if (state.editingId) {
      const existing = state.all.find((r) => r.id === state.editingId);
      previousUrl = existing?.url || null;
    }

    if (needsFile && state.selectedFile) {
      const folder = courseId.replace(/^course_/, '');
      url = await ResourcesManager.uploadResourcePdf(folder, state.selectedFile);
      // Si reemplazamos un PDF anterior propio, eliminar el archivo viejo.
      if (previousUrl && previousUrl !== url && previousUrl.includes('/eduquest-docs/')) {
        await ResourcesManager.deleteResourcePdfByUrl(previousUrl);
      }
    } else if (needsFile && isEditingWithExistingPdf) {
      url = previousUrl;
    }

    const payload = { title, type, courseId, topicId, url, description };

    let savedResource;
    if (state.editingId) {
      savedResource = await ResourcesManager.updateResource(state.editingId, payload);
      window.TeacherUI?.toast('Recurso actualizado.');
    } else {
      savedResource = await ResourcesManager.createResource(payload);
      window.TeacherUI?.toast('Recurso creado.');
    }

    // Indexar en Pinecone (fire-and-forget — no bloquea la UI)
    indexResourceInRAG({
      id:          savedResource.id,
      title:       savedResource.title,
      type:        savedResource.type,
      courseId:    savedResource.course_id,
      topicId:     savedResource.topic_id,
      description: savedResource.description || '',
      url:         savedResource.url || undefined
    });

    window.TeacherUI?.closeModal('modal-resource');
    await loadResources();
  } catch (err) {
    console.error('[teacher/resources] Error guardando recurso:', err);
    window.TeacherUI?.toast('No se pudo guardar el recurso.', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// ─── Modal: eliminar ────────────────────────────────────────────────────
function wireDeleteModal() {
  window.TeacherUI?.wireModal('modal-delete-resource');
  document.getElementById('confirmDeleteResource')?.addEventListener('click', handleConfirmDelete);
}

function openDeleteModal(id) {
  state.pendingDeleteId = id;
  window.TeacherUI?.openModal('modal-delete-resource');
}

async function handleConfirmDelete() {
  const id = state.pendingDeleteId;
  if (!id) return;

  const resource = state.all.find((r) => r.id === id);
  const btn = document.getElementById('confirmDeleteResource');
  if (btn) btn.disabled = true;

  try {
    await ResourcesManager.deleteResource(id);
    if (resource?.url && resource.url.includes('/eduquest-docs/')) {
      await ResourcesManager.deleteResourcePdfByUrl(resource.url);
    }

    // Eliminar vector de Pinecone (fire-and-forget)
    deleteResourceFromRAG(id);

    window.TeacherUI?.toast('Recurso eliminado.');
    window.TeacherUI?.closeModal('modal-delete-resource');
    await loadResources();
  } catch (err) {
    console.error('[teacher/resources] Error eliminando recurso:', err);
    window.TeacherUI?.toast('No se pudo eliminar el recurso.', 'error');
  } finally {
    if (btn) btn.disabled = false;
    state.pendingDeleteId = null;
  }
}

// ─── Utils ──────────────────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}
